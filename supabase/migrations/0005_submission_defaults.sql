-- Optional proof fields get defaults so callers can omit them (and generated types mark them optional).
create or replace function public.create_submission(p_quest uuid, p_kind text, p_image_path text default null, p_sha256 text default null, p_link_url text default null, p_link_normalized text default null, p_handle text default null, p_order_number text default null, p_caption text default null, p_consent_featured boolean default false, p_consent_rights boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_q public.quests; v_ch public.channels; v_fan public.fans; v_key text; v_n int; v_auto boolean; v_sub public.submissions; v_awarded boolean := false;
  v_image text := nullif(trim(coalesce(p_image_path, '')), ''); v_sha text := nullif(trim(coalesce(p_sha256, '')), '');
  v_link text := nullif(trim(coalesce(p_link_url, '')), ''); v_norm text := nullif(trim(coalesce(p_link_normalized, '')), '');
begin
  v_fan := public.assert_fan(auth.uid());
  v_q := public._open_quest(p_quest, v_fan.id);
  if v_q.type not in ('photo_proof', 'receipt_proof', 'social_link', 'social_screenshot') then raise exception 'WRONG_TYPE'; end if;
  if (v_q.type in ('photo_proof', 'receipt_proof', 'social_screenshot') and (p_kind <> 'image' or v_image is null)) or (v_q.type = 'social_link' and (p_kind <> 'link' or v_norm is null)) then raise exception 'WRONG_KIND'; end if;
  select * into v_ch from public.channels where id = v_q.channel_id;
  select count(*) into v_n from public.submissions where fan_id = v_fan.id and channel_id = v_ch.id
    and (created_at at time zone v_ch.timezone)::date = (now() at time zone v_ch.timezone)::date;
  if v_n >= coalesce((v_ch.settings ->> 'submissions_per_day')::int, 10) then raise exception 'DAILY_CAP'; end if;
  select count(*) into v_n from public.submissions where fan_id = v_fan.id and channel_id = v_ch.id and status = 'pending';
  if v_n >= coalesce((v_ch.settings ->> 'max_pending')::int, 5) then raise exception 'PENDING_CAP'; end if;
  select count(*) into v_n from public.submissions where fan_id = v_fan.id and channel_id = v_ch.id and status = 'rejected' and reviewed_at > now() - interval '30 days';
  if v_n >= 3 then raise exception 'REJECT_BLOCK'; end if;
  if exists (select 1 from public.submissions where fan_id = v_fan.id and quest_id = v_q.id and status = 'rejected' and reject_mode = 'final') then raise exception 'FINAL_REJECTED'; end if;
  v_key := public.period_key_for(v_q.repeat_rule, v_ch.timezone, coalesce(nullif(trim(coalesce(p_order_number, '')), ''), v_norm, v_sha));
  if v_q.repeat_rule <> 'per_item' and exists (select 1 from public.xp_ledger where fan_id = v_fan.id and quest_id = v_q.id and period_key = v_key and xp > 0) then raise exception 'ALREADY_DONE'; end if;
  v_auto := coalesce((v_q.config ->> 'auto_approve')::boolean, false);
  begin
    insert into public.submissions (channel_id, fan_id, quest_id, kind, status, image_path, file_sha256, link_url, link_normalized, handle, order_number, caption, consent_featured, consent_rights)
    values (v_ch.id, v_fan.id, v_q.id, p_kind, case when v_auto then 'approved' else 'pending' end, v_image, v_sha, v_link, v_norm, nullif(trim(coalesce(p_handle, '')), ''), nullif(trim(coalesce(p_order_number, '')), ''), nullif(trim(coalesce(p_caption, '')), ''), coalesce(p_consent_featured, false), coalesce(p_consent_rights, false))
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
