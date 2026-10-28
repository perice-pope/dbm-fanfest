-- 0009: Last.fm as a second listening source, and small XP for any play (EJAE-style: every play counts, band plays count more).

alter table public.listen_accounts drop constraint listen_accounts_service_check;
alter table public.listen_accounts add constraint listen_accounts_service_check check (service in ('listenbrainz', 'lastfm'));
-- Last.fm web-auth session key, kept so a fan whose recent listening is private can still be read. Never sent to the browser.
alter table public.listen_accounts add column if not exists session_key text;
revoke select on public.listen_accounts from authenticated;
grant select (fan_id, service, username, connected_at, last_synced_at) on public.listen_accounts to authenticated;

-- p_plays: [{ "track": text, "listened_at": unix seconds, "band": boolean }]. Band plays pay quest.xp once per song per local day
-- (config.daily_cap songs a day). Other plays pay config.any_play_xp (default 0) once each, up to config.any_play_cap a day (default 10).
create or replace function public.award_listens(p_quest uuid, p_fan uuid, p_plays jsonb, p_allow_draft boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_q public.quests; v_ch public.channels; v_fan public.fans; v_acc public.listen_accounts; v_cap int; v_any_xp int; v_any_cap int; v_play jsonb;
  v_track text; v_at timestamptz; v_day text; v_n int; v_awarded int := 0; v_capped int := 0; v_xp int := 0; v_any int := 0;
begin
  v_fan := public.assert_fan(p_fan);
  select * into v_q from public.quests where id = p_quest and type = 'listen' and (status = 'live' or (p_allow_draft and status = 'draft'));
  if not found then raise exception 'QUEST_UNAVAILABLE'; end if;
  if v_q.deadline is not null and v_q.deadline <= now() then raise exception 'QUEST_ENDED'; end if;
  if v_q.lock_min_xp > 0 and public.fan_total_xp(v_q.channel_id, p_fan) < v_q.lock_min_xp then raise exception 'QUEST_LOCKED'; end if;
  select * into v_acc from public.listen_accounts where fan_id = p_fan;
  if not found then raise exception 'NOT_CONNECTED'; end if;
  select * into v_ch from public.channels where id = v_q.channel_id;
  v_cap := greatest(coalesce((v_q.config->>'daily_cap')::int, 4), 0);
  v_any_xp := greatest(coalesce((v_q.config->>'any_play_xp')::int, 0), 0);
  v_any_cap := greatest(coalesce((v_q.config->>'any_play_cap')::int, 10), 0);
  for v_play in select value from jsonb_array_elements(coalesce(p_plays, '[]'::jsonb)) with ordinality t(value, i)
                order by (value->>'listened_at')::bigint limit 1000 loop
    v_track := left(btrim(coalesce(v_play->>'track', '')), 200);
    v_at := to_timestamp((v_play->>'listened_at')::bigint);
    if v_track = '' or v_at < v_acc.connected_at or v_at > now() + interval '5 minutes' then continue; end if;
    v_day := to_char((v_at at time zone v_ch.timezone)::date, 'YYYY-MM-DD');
    if coalesce((v_play->>'band')::boolean, true) then
      select count(*) into v_n from public.xp_ledger
        where fan_id = p_fan and quest_id = v_q.id and xp > 0 and source = 'listen' and period_key like v_day || ':%';
      if v_n >= v_cap then v_capped := v_capped + 1; continue; end if;
      if public._award_xp(v_ch.id, p_fan, v_q.id, 'listen', v_day || ':' || lower(v_track), v_q.xp, 'Streamed "' || v_track || '"', 'listen', null) then
        v_awarded := v_awarded + 1; v_xp := v_xp + v_q.xp;
      end if;
    elsif v_any_xp > 0 then
      select count(*) into v_n from public.xp_ledger
        where fan_id = p_fan and quest_id = v_q.id and xp > 0 and source = 'listen_any' and period_key like v_day || ':any:%';
      if v_n >= v_any_cap then continue; end if;
      -- One row per play: the timestamp is the dedupe key, as on the EJAE site.
      if public._award_xp(v_ch.id, p_fan, v_q.id, 'listen_any', v_day || ':any:' || (v_play->>'listened_at'), v_any_xp, 'Streamed music', 'listen', null) then
        v_any := v_any + 1; v_xp := v_xp + v_any_xp;
      end if;
    end if;
  end loop;
  return jsonb_build_object('awarded', v_awarded, 'any', v_any, 'xp', v_xp, 'capped', v_capped);
end $$;
revoke execute on function public.award_listens(uuid, uuid, jsonb, boolean) from public, anon, authenticated;

update public.quests set
  description = 'Connect Last.fm (or ListenBrainz) to your streaming app. Every play earns a little XP, and our songs earn more.',
  config = config || jsonb_build_object('any_play_xp', 5, 'any_play_cap', 10,
    'hint', 'Any play: 5 XP, up to 10 a day. Our songs: 25 XP each, up to 4 songs a day. Plays count from when you connect.')
where type = 'listen' and config->>'any_play_xp' is null;
