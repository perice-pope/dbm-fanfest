-- Review fixes: reward payload privacy, server-side proof rules, reversal amounts, invite conversion,
-- admin fan scoping, quiz readiness.

-- 1. Reward delivery payloads and draw winners are not readable from the row by fans or visitors.
revoke select on public.rewards from anon, authenticated;
grant select (id, channel_id, type, title, body, image_url, stock, delivery_type, draw_ends_at, picked_at, min_lifetime_xp, status, sort_order, created_at)
  on public.rewards to anon, authenticated;

create or replace function public.my_claims(p_channel uuid)
returns table(reward_id uuid, delivery_type text, delivery_payload text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.id, r.delivery_type, r.delivery_payload, c.created_at
  from public.reward_claims c join public.rewards r on r.id = c.reward_id
  where c.fan_id = auth.uid() and r.channel_id = p_channel;
$$;

create or replace function public.admin_rewards(p_channel uuid)
returns setof public.rewards
language sql stable security definer set search_path = public as $$
  select * from public.rewards where channel_id = p_channel and public.is_admin(p_channel) order by sort_order, created_at;
$$;

-- 2. One reversal per submission; reversals pay back what was actually paid.
create unique index if not exists xp_ledger_one_reversal on public.xp_ledger (ref_type, ref_id) where source = 'reversal';

create or replace function public.moderate_upload(p_id uuid, p_action text, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_s public.submissions; v_q public.quests; v_paid int;
begin
  select * into v_s from public.submissions where id = p_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if not public.is_admin(v_s.channel_id) then raise exception 'FORBIDDEN'; end if;
  select * into v_q from public.quests where id = v_s.quest_id;
  if p_action = 'feature' then
    update public.submissions set featured_at = now(), hidden_at = null where id = p_id;
  elsif p_action = 'unfeature' then
    update public.submissions set featured_at = null where id = p_id;
  elsif p_action = 'hide' then
    update public.submissions set hidden_at = now(), featured_at = null where id = p_id;
  elsif p_action = 'unhide' then
    update public.submissions set hidden_at = null where id = p_id;
  elsif p_action = 'remove' then
    if v_s.removed_at is null then
      update public.submissions set removed_at = now(), hidden_at = now(), featured_at = null where id = p_id;
      select xp into v_paid from public.xp_ledger where ref_type = 'submission' and ref_id = v_s.id and xp > 0 order by created_at limit 1;
      if v_paid is not null then
        insert into public.xp_ledger (channel_id, fan_id, quest_id, source, ref_type, ref_id, period_key, xp, note)
        values (v_s.channel_id, v_s.fan_id, null, 'reversal', 'submission', v_s.id, '', -v_paid, coalesce(p_reason, 'Removed: ' || v_q.title))
        on conflict do nothing;
      end if;
    end if;
  else
    raise exception 'BAD_ACTION';
  end if;
  insert into public.admin_actions (channel_id, admin_id, action, target_type, target_id, after) values (v_s.channel_id, auth.uid(), 'moderate_' || p_action, 'submission', p_id, jsonb_build_object('reason', p_reason));
  return jsonb_build_object('ok', true);
end $$;

-- 3. Invite converts on the invitee's first qualifying award, whatever else is in the ledger.
create or replace function public._award_xp(p_channel uuid, p_fan uuid, p_quest uuid, p_source text, p_period_key text, p_xp int, p_note text, p_ref_type text default null, p_ref_id uuid default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_new_id uuid; v_inv public.invites; v_iq public.quests; v_cap int; v_count int;
begin
  if p_xp = 0 then return false; end if;
  insert into public.xp_ledger (channel_id, fan_id, quest_id, source, ref_type, ref_id, period_key, xp, note)
  values (p_channel, p_fan, p_quest, p_source, p_ref_type, p_ref_id, coalesce(p_period_key, ''), p_xp, p_note)
  on conflict do nothing
  returning id into v_new_id;
  if v_new_id is null then return false; end if;
  if p_xp <= 0 or p_source in ('daily_visit', 'invite', 'admin_adjustment') then return true; end if;
  select * into v_inv from public.invites where invitee_fan_id = p_fan and channel_id = p_channel and converted_at is null;
  if not found then return true; end if;
  if exists (select 1 from public.xp_ledger l where l.fan_id = p_fan and l.channel_id = p_channel and l.xp > 0
               and l.source not in ('daily_visit', 'invite', 'admin_adjustment') and l.id <> v_new_id) then
    return true;
  end if;
  update public.invites set converted_at = now() where id = v_inv.id;
  select * into v_iq from public.quests where channel_id = p_channel and type = 'invite' and status = 'live' order by sort_order limit 1;
  if not found then return true; end if;
  v_cap := coalesce((v_iq.config->>'cap')::int, 10);
  select count(*) into v_count from public.invites where inviter_fan_id = v_inv.inviter_fan_id and channel_id = p_channel and converted_at is not null;
  if v_count <= v_cap then
    insert into public.xp_ledger (channel_id, fan_id, quest_id, source, ref_type, ref_id, period_key, xp, note)
    values (p_channel, v_inv.inviter_fan_id, v_iq.id, 'invite', 'invite', v_inv.id, v_inv.invitee_fan_id::text, v_iq.xp, v_iq.title)
    on conflict do nothing;
  end if;
  return true;
end $$;
revoke execute on function public._award_xp(uuid, uuid, uuid, text, text, int, text, text, uuid) from public, anon, authenticated;

-- 4. Social links are validated and normalised in the database, not only in the app.
create or replace function public.normalize_social_link(p_url text) returns text
language plpgsql immutable as $$
declare v_m text[]; v_host text; v_path text; v_query text; v_parts text[]; v_keep text[] := '{}'; v_p text; v_key text;
begin
  if p_url is null then return null; end if;
  v_m := regexp_match(trim(p_url), '^https://([^/?#]+)([^?#]*)(?:\?([^#]*))?(?:#.*)?$', 'i');
  if v_m is null then return null; end if;
  v_host := regexp_replace(regexp_replace(lower(v_m[1]), ':\d+$', ''), '^(www|m|mobile)\.', '');
  if v_host like '%.instagram.com' then v_host := 'instagram.com'; end if;
  if v_host not in ('instagram.com', 'tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com', 'facebook.com', 'fb.watch', 'fb.com') then return null; end if;
  v_path := regexp_replace(coalesce(v_m[2], ''), '/+$', '');
  v_query := coalesce(v_m[3], '');
  if v_query <> '' then
    v_parts := string_to_array(v_query, '&');
    foreach v_p in array v_parts loop
      v_key := split_part(v_p, '=', 1);
      if v_p <> '' and v_key !~* '^(igsh|igshid|utm_.*|_t|_r|fbclid)$' then v_keep := v_keep || v_p; end if;
    end loop;
    v_query := array_to_string(v_keep, '&');
  end if;
  return v_host || v_path || case when v_query <> '' then '?' || v_query else '' end;
end $$;

create or replace function public.create_submission(p_quest uuid, p_kind text, p_image_path text default null, p_sha256 text default null, p_link_url text default null, p_link_normalized text default null, p_handle text default null, p_order_number text default null, p_caption text default null, p_consent_featured boolean default false, p_consent_rights boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_q public.quests; v_ch public.channels; v_fan public.fans; v_key text; v_n int; v_auto boolean; v_sub public.submissions; v_awarded boolean := false;
  v_image text := nullif(trim(coalesce(p_image_path, '')), ''); v_sha text := lower(nullif(trim(coalesce(p_sha256, '')), ''));
  v_link text := nullif(trim(coalesce(p_link_url, '')), ''); v_norm text; v_order text;
begin
  v_fan := public.assert_fan(auth.uid());
  v_q := public._open_quest(p_quest, v_fan.id);
  if v_q.type not in ('photo_proof', 'receipt_proof', 'social_link', 'social_screenshot') then raise exception 'WRONG_TYPE'; end if;
  select * into v_ch from public.channels where id = v_q.channel_id;
  if v_q.type = 'social_link' then
    if p_kind <> 'link' then raise exception 'WRONG_KIND'; end if;
    v_norm := public.normalize_social_link(v_link);
    if v_norm is null then raise exception 'BAD_LINK'; end if;
    v_image := null; v_sha := null;
  else
    if p_kind <> 'image' then raise exception 'WRONG_KIND'; end if;
    if v_image is null or v_image not like v_ch.id::text || '/' || v_fan.id::text || '/%' then raise exception 'WRONG_KIND'; end if;
    if v_sha is null or v_sha !~ '^[a-f0-9]{64}$' then raise exception 'WRONG_KIND'; end if;
    v_link := null; v_norm := null;
  end if;
  if v_q.type = 'receipt_proof' then
    v_order := upper(regexp_replace(coalesce(p_order_number, ''), '[^A-Za-z0-9]', '', 'g'));
    if length(v_order) < 3 then raise exception 'BAD_ORDER'; end if;
  end if;
  select count(*) into v_n from public.submissions where fan_id = v_fan.id and channel_id = v_ch.id
    and (created_at at time zone v_ch.timezone)::date = (now() at time zone v_ch.timezone)::date;
  if v_n >= coalesce((v_ch.settings ->> 'submissions_per_day')::int, 10) then raise exception 'DAILY_CAP'; end if;
  select count(*) into v_n from public.submissions where fan_id = v_fan.id and channel_id = v_ch.id and status = 'pending';
  if v_n >= coalesce((v_ch.settings ->> 'max_pending')::int, 5) then raise exception 'PENDING_CAP'; end if;
  select count(*) into v_n from public.submissions where fan_id = v_fan.id and channel_id = v_ch.id and status = 'rejected' and reviewed_at > now() - interval '30 days';
  if v_n >= 3 then raise exception 'REJECT_BLOCK'; end if;
  select count(*) into v_n from public.submissions where fan_id = v_fan.id and quest_id = v_q.id and status = 'rejected';
  if v_n >= 2 or exists (select 1 from public.submissions where fan_id = v_fan.id and quest_id = v_q.id and status = 'rejected' and reject_mode = 'final') then raise exception 'FINAL_REJECTED'; end if;
  v_key := public.period_key_for(v_q.repeat_rule, v_ch.timezone, coalesce(v_order, v_norm, v_sha));
  if v_q.repeat_rule <> 'per_item' and exists (select 1 from public.xp_ledger where fan_id = v_fan.id and quest_id = v_q.id and period_key = v_key and xp > 0) then raise exception 'ALREADY_DONE'; end if;
  v_auto := coalesce((v_q.config ->> 'auto_approve')::boolean, false);
  begin
    insert into public.submissions (channel_id, fan_id, quest_id, kind, status, image_path, file_sha256, link_url, link_normalized, handle, order_number, caption, consent_featured, consent_rights)
    values (v_ch.id, v_fan.id, v_q.id, p_kind, case when v_auto then 'approved' else 'pending' end, v_image, v_sha, v_link, v_norm, nullif(trim(coalesce(p_handle, '')), ''), v_order, nullif(trim(coalesce(p_caption, '')), ''), coalesce(p_consent_featured, false), coalesce(p_consent_rights, false))
    returning * into v_sub;
  exception when unique_violation then
    raise exception 'ALREADY_SUBMITTED';
  end;
  if v_auto then
    v_awarded := public._award_xp(v_ch.id, v_fan.id, v_q.id, 'upload', v_key, v_q.xp, v_q.title, 'submission', v_sub.id);
    update public.submissions set xp_awarded = v_awarded, reviewed_at = now() where id = v_sub.id;
  end if;
  return jsonb_build_object('id', v_sub.id, 'status', v_sub.status, 'awarded', v_awarded, 'xp', case when v_awarded then v_q.xp else 0 end);
end $$;

-- 5. Quiz grading uses the question count from the config and refuses an out-of-sync answer key.
create or replace function public.submit_response(p_quest uuid, p_answers jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_q public.quests; v_ch public.channels; v_fan public.fans; v_key text; v_total int := 0; v_keys int := 0; v_correct int := 0; v_xp int; v_i int; v_ans int; v_corr int; v_awarded boolean := false; v_correct_list jsonb := '[]'::jsonb;
begin
  v_fan := public.assert_fan(auth.uid());
  v_q := public._open_quest(p_quest, v_fan.id);
  if v_q.type not in ('quiz', 'poll', 'weekly_vote') then raise exception 'WRONG_TYPE'; end if;
  select * into v_ch from public.channels where id = v_q.channel_id;
  v_key := public.period_key_for(case when v_q.type = 'weekly_vote' then 'weekly' else v_q.repeat_rule end, v_ch.timezone);
  if v_q.type = 'quiz' then
    v_total := coalesce(jsonb_array_length(v_q.config -> 'questions'), 0);
    select count(*) into v_keys from public.quiz_answers where quest_id = v_q.id;
    if v_total = 0 or v_keys <> v_total then raise exception 'QUIZ_NOT_READY'; end if;
    for v_i in 0 .. v_total - 1 loop
      select correct_index into v_corr from public.quiz_answers where quest_id = v_q.id and question_index = v_i;
      v_ans := nullif(p_answers ->> v_i, '')::int;
      v_correct_list := v_correct_list || to_jsonb(v_corr);
      if v_ans is not null and v_ans = v_corr then v_correct := v_correct + 1; end if;
    end loop;
    v_xp := (floor((v_q.xp::numeric * v_correct / v_total) / 10) * 10)::int;
  else
    v_xp := v_q.xp;
  end if;
  begin
    insert into public.quest_responses (quest_id, fan_id, period_key, answers, score)
    values (v_q.id, v_fan.id, v_key, p_answers, case when v_q.type = 'quiz' then v_correct else null end);
  exception when unique_violation then
    raise exception 'ALREADY_DONE';
  end;
  if v_xp > 0 then
    v_awarded := public._award_xp(v_ch.id, v_fan.id, v_q.id, v_q.type, v_key, v_xp, v_q.title);
  end if;
  return jsonb_build_object('awarded', v_awarded, 'xp', case when v_awarded then v_xp else 0 end, 'score', v_correct, 'total', v_total,
    'correct', case when v_q.type = 'quiz' then v_correct_list else null end);
end $$;

-- 6. Admins only see fans who have done something in a channel they administer.
create or replace function public.fan_active_in_channel(p_channel uuid, p_fan uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.xp_ledger l where l.fan_id = p_fan and l.channel_id = p_channel)
      or exists (select 1 from public.submissions s where s.fan_id = p_fan and s.channel_id = p_channel)
      or exists (select 1 from public.email_signups e where e.fan_id = p_fan and e.channel_id = p_channel)
      or exists (select 1 from public.link_visits v where v.fan_id = p_fan and v.channel_id = p_channel)
      or exists (select 1 from public.reward_claims c join public.rewards r on r.id = c.reward_id where c.fan_id = p_fan and r.channel_id = p_channel)
      or exists (select 1 from public.reward_entries c join public.rewards r on r.id = c.reward_id where c.fan_id = p_fan and r.channel_id = p_channel)
      or exists (select 1 from public.invites i where (i.invitee_fan_id = p_fan or i.inviter_fan_id = p_fan) and i.channel_id = p_channel)
      or exists (select 1 from public.channel_admins a where a.fan_id = p_fan and a.channel_id = p_channel);
$$;

create or replace function public.admin_can_see_fan(p_fan uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.channel_admins a where a.fan_id = auth.uid() and public.fan_active_in_channel(a.channel_id, p_fan));
$$;

drop policy if exists "fans admin read" on public.fans;
create policy "fans admin read" on public.fans for select using (public.admin_can_see_fan(id));

create or replace function public.admin_channel_fans(p_channel uuid, p_q text default null, p_limit int default 100)
returns setof public.fans
language sql stable security definer set search_path = public as $$
  select f.* from public.fans f
  where public.is_admin(p_channel) and public.fan_active_in_channel(p_channel, f.id)
    and (p_q is null or p_q = '' or f.display_name ilike '%' || p_q || '%' or f.email ilike '%' || p_q || '%')
  order by f.created_at desc
  limit p_limit;
$$;

create or replace function public.admin_channel_fan_count(p_channel uuid) returns bigint
language sql stable security definer set search_path = public as $$
  select count(*) from public.fans f where public.is_admin(p_channel) and public.fan_active_in_channel(p_channel, f.id);
$$;

create or replace function public.set_fan_status(p_channel uuid, p_fan uuid, p_status text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_before text;
begin
  if not public.is_admin(p_channel) then raise exception 'FORBIDDEN'; end if;
  if not public.fan_active_in_channel(p_channel, p_fan) then raise exception 'FORBIDDEN'; end if;
  if p_status not in ('active', 'hidden', 'banned') then raise exception 'BAD_STATUS'; end if;
  select status into v_before from public.fans where id = p_fan;
  update public.fans set status = p_status where id = p_fan;
  insert into public.admin_actions (channel_id, admin_id, action, target_type, target_id, before, after) values (p_channel, auth.uid(), 'set_fan_status', 'fan', p_fan, to_jsonb(v_before), to_jsonb(p_status));
  return jsonb_build_object('ok', true);
end $$;
