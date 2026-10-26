-- DBM FanFest: server-side rules. Every XP write goes through _award_xp.

create or replace function public.period_key_for(p_rule text, p_tz text, p_item text default null, p_at timestamptz default now())
returns text language sql stable as $$
  select case p_rule
    when 'once' then ''
    when 'daily' then to_char((p_at at time zone p_tz)::date, 'YYYY-MM-DD')
    when 'weekly' then to_char((p_at at time zone p_tz)::date, 'IYYY-"W"IW')
    when 'monthly' then to_char((p_at at time zone p_tz)::date, 'YYYY-MM')
    when 'per_item' then coalesce(p_item, '')
    else '' end
$$;

create or replace function public.fan_total_xp(p_channel uuid, p_fan uuid) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce(sum(xp), 0)::int from public.xp_ledger
  where channel_id = p_channel and fan_id = p_fan and source <> 'reward_claim';
$$;

create or replace function public.assert_fan(p_fan uuid) returns public.fans
language plpgsql stable security definer set search_path = public as $$
declare v_fan public.fans;
begin
  if p_fan is null then raise exception 'SIGN_IN_REQUIRED'; end if;
  select * into v_fan from public.fans where id = p_fan;
  if not found then raise exception 'NO_FAN'; end if;
  if v_fan.status = 'banned' then raise exception 'BANNED'; end if;
  return v_fan;
end $$;

create or replace function public._open_quest(p_quest uuid, p_fan uuid) returns public.quests
language plpgsql stable security definer set search_path = public as $$
declare v_q public.quests;
begin
  select * into v_q from public.quests where id = p_quest and status = 'live';
  if not found then raise exception 'QUEST_UNAVAILABLE'; end if;
  if v_q.deadline is not null and v_q.deadline <= now() then raise exception 'QUEST_ENDED'; end if;
  if v_q.lock_min_xp > 0 and public.fan_total_xp(v_q.channel_id, p_fan) < v_q.lock_min_xp then raise exception 'QUEST_LOCKED'; end if;
  return v_q;
end $$;

-- Internal. One row per award; the partial unique index stops double pay.
create or replace function public._award_xp(p_channel uuid, p_fan uuid, p_quest uuid, p_source text, p_period_key text, p_xp int, p_note text, p_ref_type text default null, p_ref_id uuid default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_inserted boolean := false; v_inv public.invites; v_iq public.quests; v_cap int; v_count int;
begin
  if p_xp = 0 then return false; end if;
  insert into public.xp_ledger (channel_id, fan_id, quest_id, source, ref_type, ref_id, period_key, xp, note)
  values (p_channel, p_fan, p_quest, p_source, p_ref_type, p_ref_id, coalesce(p_period_key, ''), p_xp, p_note)
  on conflict do nothing;
  v_inserted := found;
  if not v_inserted or p_xp <= 0 or p_source in ('daily_visit', 'invite') then return v_inserted; end if;
  -- Invite converts on the invitee's first award other than Daily Visit; the inviter is paid in this transaction.
  select * into v_inv from public.invites where invitee_fan_id = p_fan and channel_id = p_channel and converted_at is null;
  if not found then return v_inserted; end if;
  select count(*) into v_count from public.xp_ledger where fan_id = p_fan and channel_id = p_channel and xp > 0 and source <> 'daily_visit';
  if v_count <> 1 then return v_inserted; end if;
  update public.invites set converted_at = now() where id = v_inv.id;
  select * into v_iq from public.quests where channel_id = p_channel and type = 'invite' and status = 'live' order by sort_order limit 1;
  if not found then return v_inserted; end if;
  v_cap := coalesce((v_iq.config->>'cap')::int, 10);
  select count(*) into v_count from public.invites where inviter_fan_id = v_inv.inviter_fan_id and channel_id = p_channel and converted_at is not null;
  if v_count <= v_cap then
    insert into public.xp_ledger (channel_id, fan_id, quest_id, source, ref_type, ref_id, period_key, xp, note)
    values (p_channel, v_inv.inviter_fan_id, v_iq.id, 'invite', 'invite', v_inv.id, v_inv.invitee_fan_id::text, v_iq.xp, v_iq.title)
    on conflict do nothing;
  end if;
  return v_inserted;
end $$;
revoke execute on function public._award_xp(uuid, uuid, uuid, text, text, int, text, text, uuid) from public, anon, authenticated;
revoke execute on function public._open_quest(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.assert_fan(uuid) from public, anon, authenticated;

create or replace function public.check_in(p_channel_slug text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_ch public.channels; v_q public.quests; v_fan public.fans; v_awarded boolean := false;
begin
  v_fan := public.assert_fan(auth.uid());
  select * into v_ch from public.channels where slug = p_channel_slug;
  if not found then raise exception 'NO_CHANNEL'; end if;
  update public.fans set last_seen_at = now() where id = v_fan.id;
  select * into v_q from public.quests where channel_id = v_ch.id and type = 'daily_visit' and status = 'live' order by sort_order limit 1;
  if found and (v_q.deadline is null or v_q.deadline > now()) then
    v_awarded := public._award_xp(v_ch.id, v_fan.id, v_q.id, 'daily_visit', public.period_key_for('daily', v_ch.timezone), v_q.xp, v_q.title);
  end if;
  return jsonb_build_object('awarded', v_awarded, 'xp', case when v_awarded then v_q.xp else 0 end);
end $$;

create or replace function public.record_link_visit(p_quest uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_q public.quests; v_ch public.channels; v_fan public.fans; v_awarded boolean := false;
begin
  v_fan := public.assert_fan(auth.uid());
  v_q := public._open_quest(p_quest, v_fan.id);
  if v_q.type <> 'visit_link' then raise exception 'WRONG_TYPE'; end if;
  select * into v_ch from public.channels where id = v_q.channel_id;
  insert into public.link_visits (channel_id, fan_id, quest_id) values (v_ch.id, v_fan.id, v_q.id);
  v_awarded := public._award_xp(v_ch.id, v_fan.id, v_q.id, 'visit_link', public.period_key_for(v_q.repeat_rule, v_ch.timezone), v_q.xp, v_q.title);
  return jsonb_build_object('awarded', v_awarded, 'xp', case when v_awarded then v_q.xp else 0 end, 'url', v_q.link_url);
end $$;

create or replace function public.submit_response(p_quest uuid, p_answers jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_q public.quests; v_ch public.channels; v_fan public.fans; v_key text; v_total int := 0; v_correct int := 0; v_xp int; v_i int; v_ans int; v_corr int; v_awarded boolean := false; v_correct_list jsonb := '[]'::jsonb;
begin
  v_fan := public.assert_fan(auth.uid());
  v_q := public._open_quest(p_quest, v_fan.id);
  if v_q.type not in ('quiz', 'poll', 'weekly_vote') then raise exception 'WRONG_TYPE'; end if;
  select * into v_ch from public.channels where id = v_q.channel_id;
  v_key := public.period_key_for(case when v_q.type = 'weekly_vote' then 'weekly' else v_q.repeat_rule end, v_ch.timezone);
  if v_q.type = 'quiz' then
    select count(*) into v_total from public.quiz_answers where quest_id = v_q.id;
    if v_total = 0 then raise exception 'QUIZ_NOT_READY'; end if;
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

create or replace function public.create_submission(p_quest uuid, p_kind text, p_image_path text, p_sha256 text, p_link_url text, p_link_normalized text, p_handle text, p_order_number text, p_caption text, p_consent_featured boolean, p_consent_rights boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_q public.quests; v_ch public.channels; v_fan public.fans; v_key text; v_n int; v_auto boolean; v_sub public.submissions; v_awarded boolean := false;
begin
  v_fan := public.assert_fan(auth.uid());
  v_q := public._open_quest(p_quest, v_fan.id);
  if v_q.type not in ('photo_proof', 'receipt_proof', 'social_link', 'social_screenshot') then raise exception 'WRONG_TYPE'; end if;
  if (v_q.type in ('photo_proof', 'receipt_proof', 'social_screenshot') and p_kind <> 'image') or (v_q.type = 'social_link' and p_kind <> 'link') then raise exception 'WRONG_KIND'; end if;
  select * into v_ch from public.channels where id = v_q.channel_id;
  select count(*) into v_n from public.submissions where fan_id = v_fan.id and channel_id = v_ch.id
    and (created_at at time zone v_ch.timezone)::date = (now() at time zone v_ch.timezone)::date;
  if v_n >= coalesce((v_ch.settings ->> 'submissions_per_day')::int, 10) then raise exception 'DAILY_CAP'; end if;
  select count(*) into v_n from public.submissions where fan_id = v_fan.id and channel_id = v_ch.id and status = 'pending';
  if v_n >= coalesce((v_ch.settings ->> 'max_pending')::int, 5) then raise exception 'PENDING_CAP'; end if;
  select count(*) into v_n from public.submissions where fan_id = v_fan.id and channel_id = v_ch.id and status = 'rejected' and reviewed_at > now() - interval '30 days';
  if v_n >= 3 then raise exception 'REJECT_BLOCK'; end if;
  if exists (select 1 from public.submissions where fan_id = v_fan.id and quest_id = v_q.id and status = 'rejected' and reject_mode = 'final') then raise exception 'FINAL_REJECTED'; end if;
  v_key := public.period_key_for(v_q.repeat_rule, v_ch.timezone, coalesce(p_order_number, p_link_normalized, p_sha256));
  if v_q.repeat_rule <> 'per_item' and exists (select 1 from public.xp_ledger where fan_id = v_fan.id and quest_id = v_q.id and period_key = v_key and xp > 0) then raise exception 'ALREADY_DONE'; end if;
  v_auto := coalesce((v_q.config ->> 'auto_approve')::boolean, false);
  begin
    insert into public.submissions (channel_id, fan_id, quest_id, kind, status, image_path, file_sha256, link_url, link_normalized, handle, order_number, caption, consent_featured, consent_rights)
    values (v_ch.id, v_fan.id, v_q.id, p_kind, case when v_auto then 'approved' else 'pending' end, p_image_path, p_sha256, p_link_url, p_link_normalized, nullif(trim(p_handle), ''), nullif(trim(p_order_number), ''), nullif(trim(p_caption), ''), coalesce(p_consent_featured, false), coalesce(p_consent_rights, false))
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

create or replace function public.approve_submission(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_s public.submissions; v_q public.quests; v_ch public.channels; v_key text; v_awarded boolean := false;
begin
  select * into v_s from public.submissions where id = p_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if not public.is_admin(v_s.channel_id) then raise exception 'FORBIDDEN'; end if;
  if v_s.status <> 'pending' then return jsonb_build_object('status', v_s.status, 'awarded', false, 'already', true); end if;
  select * into v_q from public.quests where id = v_s.quest_id;
  select * into v_ch from public.channels where id = v_s.channel_id;
  v_key := public.period_key_for(v_q.repeat_rule, v_ch.timezone, coalesce(v_s.order_number, v_s.link_normalized, v_s.file_sha256, v_s.id::text), v_s.created_at);
  update public.submissions set status = 'approved', reviewer_id = auth.uid(), reviewed_at = now() where id = p_id;
  v_awarded := public._award_xp(v_ch.id, v_s.fan_id, v_q.id, 'quest_approval', v_key, v_q.xp, v_q.title, 'submission', v_s.id);
  update public.submissions set xp_awarded = v_awarded where id = p_id;
  insert into public.admin_actions (channel_id, admin_id, action, target_type, target_id) values (v_ch.id, auth.uid(), 'approve_submission', 'submission', p_id);
  return jsonb_build_object('status', 'approved', 'awarded', v_awarded, 'xp', case when v_awarded then v_q.xp else 0 end);
end $$;

create or replace function public.reject_submission(p_id uuid, p_reason text, p_note text, p_mode text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_s public.submissions;
begin
  select * into v_s from public.submissions where id = p_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if not public.is_admin(v_s.channel_id) then raise exception 'FORBIDDEN'; end if;
  if v_s.status <> 'pending' then return jsonb_build_object('status', v_s.status, 'already', true); end if;
  if p_reason not in ('not_visible', 'wrong_item', 'duplicate', 'inappropriate') then raise exception 'BAD_REASON'; end if;
  update public.submissions set status = 'rejected', reject_reason = p_reason, reject_note = nullif(trim(p_note), ''), reject_mode = coalesce(p_mode, 'retry'), reviewer_id = auth.uid(), reviewed_at = now() where id = p_id;
  insert into public.admin_actions (channel_id, admin_id, action, target_type, target_id, after) values (v_s.channel_id, auth.uid(), 'reject_submission', 'submission', p_id, jsonb_build_object('reason', p_reason, 'mode', p_mode));
  return jsonb_build_object('status', 'rejected');
end $$;

-- Uploads that paid on arrival: feature and hide keep the XP, remove reverses it.
create or replace function public.moderate_upload(p_id uuid, p_action text, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_s public.submissions; v_q public.quests;
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
      if v_s.xp_awarded then
        insert into public.xp_ledger (channel_id, fan_id, quest_id, source, ref_type, ref_id, period_key, xp, note)
        values (v_s.channel_id, v_s.fan_id, null, 'reversal', 'submission', v_s.id, '', -v_q.xp, coalesce(p_reason, 'Removed: ' || v_q.title));
      end if;
    end if;
  else
    raise exception 'BAD_ACTION';
  end if;
  insert into public.admin_actions (channel_id, admin_id, action, target_type, target_id, after) values (v_s.channel_id, auth.uid(), 'moderate_' || p_action, 'submission', p_id, jsonb_build_object('reason', p_reason));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.claim_reward(p_reward uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_r public.rewards; v_fan public.fans; v_claims int;
begin
  v_fan := public.assert_fan(auth.uid());
  select * into v_r from public.rewards where id = p_reward for update;
  if not found or v_r.status <> 'live' or v_r.type <> 'claim' then raise exception 'REWARD_UNAVAILABLE'; end if;
  if v_r.min_lifetime_xp > 0 and public.fan_total_xp(v_r.channel_id, v_fan.id) < v_r.min_lifetime_xp then raise exception 'REWARD_LOCKED'; end if;
  select count(*) into v_claims from public.reward_claims where reward_id = p_reward;
  if v_r.stock is not null and v_claims >= v_r.stock then raise exception 'SOLD_OUT'; end if;
  begin
    insert into public.reward_claims (reward_id, fan_id) values (p_reward, v_fan.id);
  exception when unique_violation then
    raise exception 'ALREADY_CLAIMED';
  end;
  return jsonb_build_object('delivery_type', v_r.delivery_type, 'delivery_payload', v_r.delivery_payload,
    'left', case when v_r.stock is null then null else v_r.stock - v_claims - 1 end);
end $$;

create or replace function public.enter_draw(p_reward uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_r public.rewards; v_fan public.fans; v_entries int;
begin
  v_fan := public.assert_fan(auth.uid());
  select * into v_r from public.rewards where id = p_reward for update;
  if not found or v_r.status <> 'live' or v_r.type <> 'draw' then raise exception 'REWARD_UNAVAILABLE'; end if;
  if v_r.draw_ends_at is not null and v_r.draw_ends_at <= now() then raise exception 'DRAW_CLOSED'; end if;
  if v_r.picked_at is not null then raise exception 'DRAW_CLOSED'; end if;
  if v_r.min_lifetime_xp > 0 and public.fan_total_xp(v_r.channel_id, v_fan.id) < v_r.min_lifetime_xp then raise exception 'REWARD_LOCKED'; end if;
  begin
    insert into public.reward_entries (reward_id, fan_id) values (p_reward, v_fan.id);
  exception when unique_violation then
    raise exception 'ALREADY_ENTERED';
  end;
  select count(*) into v_entries from public.reward_entries where reward_id = p_reward;
  return jsonb_build_object('entries', v_entries);
end $$;

create or replace function public.pick_winner(p_reward uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_r public.rewards; v_winner uuid;
begin
  select * into v_r from public.rewards where id = p_reward for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if not public.is_admin(v_r.channel_id) then raise exception 'FORBIDDEN'; end if;
  if v_r.picked_at is not null then raise exception 'ALREADY_PICKED'; end if;
  select fan_id into v_winner from public.reward_entries where reward_id = p_reward order by random() limit 1;
  if v_winner is null then raise exception 'NO_ENTRIES'; end if;
  update public.rewards set winner_fan_id = v_winner, picked_at = now(), status = 'closed' where id = p_reward;
  insert into public.admin_actions (channel_id, admin_id, action, target_type, target_id, after) values (v_r.channel_id, auth.uid(), 'pick_winner', 'reward', p_reward, jsonb_build_object('winner', v_winner));
  return jsonb_build_object('winner_fan_id', v_winner);
end $$;

create or replace function public.join_email_list(p_channel uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_fan public.fans; v_ch public.channels; v_q public.quests; v_awarded boolean := false; v_new boolean := false;
begin
  v_fan := public.assert_fan(auth.uid());
  select * into v_ch from public.channels where id = p_channel;
  if not found then raise exception 'NO_CHANNEL'; end if;
  insert into public.email_signups (channel_id, fan_id, email) values (v_ch.id, v_fan.id, v_fan.email) on conflict do nothing;
  v_new := found;
  update public.fans set newsletter_opt_in = true where id = v_fan.id;
  if not v_new then return jsonb_build_object('joined', false, 'awarded', false, 'xp', 0); end if;
  select * into v_q from public.quests where channel_id = v_ch.id and type = 'email_signup' and status = 'live' order by sort_order limit 1;
  if found and (v_q.deadline is null or v_q.deadline > now()) then
    v_awarded := public._award_xp(v_ch.id, v_fan.id, v_q.id, 'email_signup', '', v_q.xp, v_q.title);
  end if;
  return jsonb_build_object('joined', true, 'awarded', v_awarded, 'xp', case when v_awarded then v_q.xp else 0 end);
end $$;

create or replace function public.attach_invite(p_channel uuid, p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_fan public.fans; v_inviter public.fans; v_flag boolean := false;
begin
  v_fan := public.assert_fan(auth.uid());
  if v_fan.created_at < now() - interval '1 day' then return jsonb_build_object('attached', false, 'why', 'not_new'); end if;
  if exists (select 1 from public.invites where invitee_fan_id = v_fan.id) then return jsonb_build_object('attached', false, 'why', 'exists'); end if;
  select * into v_inviter from public.fans where referral_code = lower(trim(p_code));
  if not found or v_inviter.id = v_fan.id then return jsonb_build_object('attached', false, 'why', 'bad_code'); end if;
  insert into public.invites (channel_id, code, inviter_fan_id, invitee_fan_id) values (p_channel, lower(trim(p_code)), v_inviter.id, v_fan.id);
  return jsonb_build_object('attached', true);
end $$;

-- ---------- admin ----------
create or replace function public.adjust_xp(p_channel uuid, p_fan uuid, p_xp int, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(p_channel) then raise exception 'FORBIDDEN'; end if;
  if p_xp = 0 or nullif(trim(p_reason), '') is null then raise exception 'BAD_INPUT'; end if;
  insert into public.xp_ledger (channel_id, fan_id, quest_id, source, period_key, xp, note) values (p_channel, p_fan, null, 'admin_adjustment', '', p_xp, trim(p_reason));
  insert into public.admin_actions (channel_id, admin_id, action, target_type, target_id, after) values (p_channel, auth.uid(), 'adjust_xp', 'fan', p_fan, jsonb_build_object('xp', p_xp, 'reason', p_reason));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.set_fan_status(p_channel uuid, p_fan uuid, p_status text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_before text;
begin
  if not public.is_admin(p_channel) then raise exception 'FORBIDDEN'; end if;
  if p_status not in ('active', 'hidden', 'banned') then raise exception 'BAD_STATUS'; end if;
  select status into v_before from public.fans where id = p_fan;
  update public.fans set status = p_status where id = p_fan;
  insert into public.admin_actions (channel_id, admin_id, action, target_type, target_id, before, after) values (p_channel, auth.uid(), 'set_fan_status', 'fan', p_fan, to_jsonb(v_before), to_jsonb(p_status));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.set_quiz_answers(p_quest uuid, p_answers int[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_q public.quests; v_i int;
begin
  select * into v_q from public.quests where id = p_quest;
  if not found or not public.is_admin(v_q.channel_id) then raise exception 'FORBIDDEN'; end if;
  delete from public.quiz_answers where quest_id = p_quest;
  for v_i in 1 .. coalesce(array_length(p_answers, 1), 0) loop
    insert into public.quiz_answers (quest_id, question_index, correct_index) values (p_quest, v_i - 1, p_answers[v_i]);
  end loop;
  return jsonb_build_object('count', coalesce(array_length(p_answers, 1), 0));
end $$;

-- ---------- public reads ----------
create or replace function public._window_start(p_period text, p_tz text) returns timestamptz
language sql stable as $$
  select case p_period
    when 'weekly' then (date_trunc('week', now() at time zone p_tz)) at time zone p_tz
    when 'monthly' then (date_trunc('month', now() at time zone p_tz)) at time zone p_tz
    else '-infinity'::timestamptz end
$$;

create or replace function public.leaderboard(p_channel uuid, p_period text, p_limit int default 3, p_offset int default 0)
returns table(rank bigint, fan_id uuid, display_name text, xp bigint)
language sql stable security definer set search_path = public as $$
  with ch as (select timezone from public.channels where id = p_channel),
  totals as (
    select l.fan_id, sum(l.xp) as xp, min(l.created_at) as first_at
    from public.xp_ledger l
    join public.fans f on f.id = l.fan_id
    where l.channel_id = p_channel and l.source <> 'reward_claim'
      and f.status = 'active' and f.show_on_leaderboard
      and not exists (select 1 from public.channel_admins a where a.channel_id = p_channel and a.fan_id = l.fan_id)
      and l.created_at >= public._window_start(p_period, (select timezone from ch))
    group by l.fan_id
    having sum(l.xp) > 0
  )
  select rank() over (order by t.xp desc) as rank, t.fan_id, coalesce(f.display_name, 'A fan') as display_name, t.xp
  from totals t join public.fans f on f.id = t.fan_id
  order by rank, t.first_at
  limit p_limit offset p_offset;
$$;

create or replace function public.my_rank(p_channel uuid, p_period text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_fan public.fans; v_row record; v_xp bigint;
begin
  if auth.uid() is null then return null; end if;
  select * into v_fan from public.fans where id = auth.uid();
  if not found then return null; end if;
  select coalesce(sum(xp), 0) into v_xp from public.xp_ledger l where l.channel_id = p_channel and l.fan_id = v_fan.id and l.source <> 'reward_claim'
    and l.created_at >= public._window_start(p_period, (select timezone from public.channels where id = p_channel));
  if not v_fan.show_on_leaderboard then return jsonb_build_object('hidden', true, 'xp', v_xp); end if;
  select * into v_row from public.leaderboard(p_channel, p_period, 100000, 0) b where b.fan_id = v_fan.id;
  if not found then return jsonb_build_object('hidden', false, 'rank', null, 'xp', v_xp); end if;
  return jsonb_build_object('hidden', false, 'rank', v_row.rank, 'xp', v_row.xp);
end $$;

create or replace function public.activity_feed(p_channel uuid, p_limit int default 20)
returns table(id uuid, display_name text, note text, xp int, source text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select l.id, case when f.show_activity and f.status = 'active' then coalesce(f.display_name, 'A fan') else 'A fan' end as display_name,
    l.note, l.xp, l.source, l.created_at
  from public.xp_ledger l join public.fans f on f.id = l.fan_id
  where l.channel_id = p_channel and l.xp > 0 and f.status <> 'banned'
    and not exists (select 1 from public.channel_admins a where a.channel_id = p_channel and a.fan_id = l.fan_id)
  order by l.created_at desc
  limit p_limit;
$$;

create or replace function public.channel_stats(p_channel uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_tz text; v_start timestamptz; v_days jsonb := '[]'::jsonb; v_i int; v_sum bigint; v_week bigint; v_fans bigint; v_quests bigint; v_news bigint; v_rewards bigint;
begin
  select timezone into v_tz from public.channels where id = p_channel;
  v_start := public._window_start('weekly', v_tz);
  for v_i in 0 .. 6 loop
    select coalesce(sum(l.xp), 0) into v_sum from public.xp_ledger l
    where l.channel_id = p_channel and l.xp > 0 and l.created_at >= v_start + (v_i || ' days')::interval and l.created_at < v_start + ((v_i + 1) || ' days')::interval
      and not exists (select 1 from public.channel_admins a where a.channel_id = p_channel and a.fan_id = l.fan_id);
    v_days := v_days || to_jsonb(v_sum);
  end loop;
  select coalesce(sum(l.xp), 0) into v_week from public.xp_ledger l where l.channel_id = p_channel and l.xp > 0 and l.created_at >= v_start
    and not exists (select 1 from public.channel_admins a where a.channel_id = p_channel and a.fan_id = l.fan_id);
  select count(distinct fan_id) into v_fans from public.xp_ledger where channel_id = p_channel;
  select count(*) into v_quests from public.quests where channel_id = p_channel and status = 'live' and (deadline is null or deadline > now());
  select count(*) into v_news from public.news_items where channel_id = p_channel and is_active;
  select count(*) into v_rewards from public.rewards r where r.channel_id = p_channel and r.status = 'live'
    and (r.type = 'draw' or r.stock is null or r.stock > (select count(*) from public.reward_claims c where c.reward_id = r.id));
  return jsonb_build_object('week_xp', v_week, 'days', v_days, 'fans', v_fans, 'quests', v_quests, 'news', v_news, 'rewards', v_rewards, 'week_start', v_start);
end $$;

create or replace function public.reward_stats(p_channel uuid)
returns table(reward_id uuid, claims bigint, entries bigint, winner_name text)
language sql stable security definer set search_path = public as $$
  select r.id,
    (select count(*) from public.reward_claims c where c.reward_id = r.id),
    (select count(*) from public.reward_entries e where e.reward_id = r.id),
    (select case when f.show_activity then coalesce(f.display_name, 'A fan') else 'A fan' end from public.fans f where f.id = r.winner_fan_id)
  from public.rewards r where r.channel_id = p_channel;
$$;
