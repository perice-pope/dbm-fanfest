-- 0008: listening quest. Fans link a ListenBrainz account; plays of the band's tracks earn XP.
-- One credited play per track per fan per local day, up to config.daily_cap tracks a day.

alter table public.quests drop constraint quests_type_check;
alter table public.quests add constraint quests_type_check check (type in ('daily_visit','visit_link','invite','quiz','poll','weekly_vote','photo_proof','receipt_proof','social_link','social_screenshot','email_signup','listen'));

-- One linked listening account per fan. The server writes it after ListenBrainz confirms the fan's token; the token itself is never stored.
create table public.listen_accounts (
  fan_id uuid primary key references public.fans(id) on delete cascade,
  service text not null default 'listenbrainz' check (service in ('listenbrainz')),
  username text not null,
  connected_at timestamptz not null default now(),
  last_synced_at timestamptz,
  cursor_ts bigint not null default 0
);
-- A listening account can belong to one fan only, so friends cannot share one account's plays.
create unique index listen_accounts_username_key on public.listen_accounts (service, lower(username));
alter table public.listen_accounts enable row level security;
create policy "listen read own" on public.listen_accounts for select to authenticated using (fan_id = auth.uid());
revoke insert, update, delete, truncate, references, trigger on public.listen_accounts from anon, authenticated;

-- Pays a batch of plays the server already fetched and matched to the band. Service role only.
-- p_plays: [{ "track": text, "listened_at": unix seconds }]. Plays from before the fan connected never pay.
create or replace function public.award_listens(p_quest uuid, p_fan uuid, p_plays jsonb, p_allow_draft boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_q public.quests; v_ch public.channels; v_fan public.fans; v_acc public.listen_accounts; v_cap int; v_play jsonb;
  v_track text; v_at timestamptz; v_day text; v_n int; v_awarded int := 0; v_capped int := 0; v_xp int := 0;
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
  for v_play in select value from jsonb_array_elements(coalesce(p_plays, '[]'::jsonb)) with ordinality t(value, i)
                order by (value->>'listened_at')::bigint limit 1000 loop
    v_track := left(btrim(coalesce(v_play->>'track', '')), 200);
    v_at := to_timestamp((v_play->>'listened_at')::bigint);
    if v_track = '' or v_at < v_acc.connected_at or v_at > now() + interval '5 minutes' then continue; end if;
    v_day := to_char((v_at at time zone v_ch.timezone)::date, 'YYYY-MM-DD');
    select count(*) into v_n from public.xp_ledger
      where fan_id = p_fan and quest_id = v_q.id and xp > 0 and period_key like v_day || ':%';
    if v_n >= v_cap then v_capped := v_capped + 1; continue; end if;
    if public._award_xp(v_ch.id, p_fan, v_q.id, 'listen', v_day || ':' || lower(v_track), v_q.xp, 'Streamed "' || v_track || '"', 'listen', null) then
      v_awarded := v_awarded + 1; v_xp := v_xp + v_q.xp;
    end if;
  end loop;
  return jsonb_build_object('awarded', v_awarded, 'xp', v_xp, 'capped', v_capped);
end $$;
revoke execute on function public.award_listens(uuid, uuid, jsonb, boolean) from public, anon, authenticated;

-- Listening quest for DBM, parked as a draft until Amanda approves the ListenBrainz cost and her distributor check.
insert into public.quests (channel_id, type, title, description, xp, cta_label, repeat_rule, status, sort_order, config)
select c.id, 'listen', 'Stream Destroyed by Moths',
  'Link a free ListenBrainz account to your streaming app and earn XP every day you play our songs.',
  25, 'Connect & Stream', 'daily', 'draft', 200,
  jsonb_build_object('service', 'listenbrainz', 'artist', 'Destroyed by Moths', 'daily_cap', 4,
    'hint', 'One play of each song counts once a day, up to 4 songs a day. Plays count from when you connect.')
from public.channels c
where c.slug = 'destroyedbymoths' and not exists (select 1 from public.quests q where q.channel_id = c.id and q.type = 'listen');
