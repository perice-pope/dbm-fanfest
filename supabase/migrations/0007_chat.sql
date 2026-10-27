-- 0007: fan chat, a fans-online count, and markers for seeded filler data.

-- ---------- seed markers ----------
-- Filler fans come from scripts/seed-filler.mts. The fans update grant lists columns explicitly,
-- so signed-in fans cannot set this on themselves; only the service role writes it.
alter table public.fans add column if not exists is_seed boolean not null default false;
create index if not exists fans_seed_idx on public.fans (is_seed) where is_seed;

-- ---------- chat ----------
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  fan_id uuid not null references public.fans(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  is_seed boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create index chat_messages_channel_idx on public.chat_messages (channel_id, created_at desc);
create index chat_messages_fan_idx on public.chat_messages (fan_id, created_at desc);

alter table public.chat_messages enable row level security;
-- Everyone may read live messages; Realtime checks this policy per subscriber. Writes go through the functions below.
create policy "chat read" on public.chat_messages for select to anon, authenticated using (deleted_at is null);
revoke insert, update, delete on public.chat_messages from anon, authenticated;
-- Readers never see the seed marker: only the listed columns are selectable (Realtime payloads follow the same column grants).
revoke select on public.chat_messages from anon, authenticated;
grant select (id, channel_id, fan_id, body, created_at, deleted_at) on public.chat_messages to anon, authenticated;

alter publication supabase_realtime add table public.chat_messages;

-- Newest first. Hidden and banned fans' messages drop out with them.
create or replace function public.chat_recent(p_channel uuid, p_limit int default 50, p_before timestamptz default null)
returns table(id uuid, fan_id uuid, display_name text, body text, created_at timestamptz, is_admin boolean)
language sql stable security definer set search_path = public as $$
  select m.id, m.fan_id, coalesce(f.display_name, 'A fan') as display_name, m.body, m.created_at,
    exists (select 1 from public.channel_admins a where a.channel_id = m.channel_id and a.fan_id = m.fan_id) as is_admin
  from public.chat_messages m
  join public.fans f on f.id = m.fan_id
  where m.channel_id = p_channel and m.deleted_at is null and f.status = 'active'
    and (p_before is null or m.created_at < p_before)
  order by m.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
$$;

create or replace function public.post_chat_message(p_channel_slug text, p_body text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_fan public.fans; v_ch public.channels; v_body text; v_last public.chat_messages; v_n int; v_row public.chat_messages;
begin
  v_fan := public.assert_fan(auth.uid());
  -- Hidden fans are refused outright instead of posting into a feed nobody reads.
  if v_fan.status <> 'active' then raise exception 'FORBIDDEN'; end if;
  -- One post per fan at a time, so the counts below see what the previous call committed.
  perform pg_advisory_xact_lock(hashtext(v_fan.id::text));
  select * into v_ch from public.channels where slug = p_channel_slug;
  if not found then raise exception 'NO_CHANNEL'; end if;
  if v_fan.display_name is null or btrim(v_fan.display_name) = '' then raise exception 'NAME_REQUIRED'; end if;
  v_body := btrim(regexp_replace(coalesce(p_body, ''), '\s+', ' ', 'g'));
  if v_body = '' then raise exception 'EMPTY_MESSAGE'; end if;
  if char_length(v_body) > 500 then raise exception 'TOO_LONG'; end if;
  select count(*) into v_n from public.chat_messages where fan_id = v_fan.id and created_at > now() - interval '10 seconds';
  if v_n >= 3 then raise exception 'SLOW_DOWN'; end if;
  select count(*) into v_n from public.chat_messages where fan_id = v_fan.id and created_at > now() - interval '10 minutes';
  if v_n >= 40 then raise exception 'SLOW_DOWN'; end if;
  select * into v_last from public.chat_messages where fan_id = v_fan.id and deleted_at is null order by created_at desc limit 1;
  if found and v_last.body = v_body and v_last.created_at > now() - interval '60 seconds' then raise exception 'DUPLICATE_MESSAGE'; end if;
  insert into public.chat_messages (channel_id, fan_id, body) values (v_ch.id, v_fan.id, v_body) returning * into v_row;
  update public.fans set last_seen_at = now() where id = v_fan.id;
  return jsonb_build_object('id', v_row.id, 'fan_id', v_row.fan_id, 'display_name', v_fan.display_name, 'body', v_row.body,
    'created_at', v_row.created_at, 'is_admin', public.is_admin(v_ch.id));
end $$;
revoke execute on function public.post_chat_message(text, text) from public, anon;

-- A fan may remove their own message; a channel admin may remove any, and that is logged.
create or replace function public.delete_chat_message(p_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_m public.chat_messages;
begin
  if auth.uid() is null then raise exception 'SIGN_IN_REQUIRED'; end if;
  select * into v_m from public.chat_messages where id = p_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_m.fan_id <> auth.uid() and not public.is_admin(v_m.channel_id) then raise exception 'FORBIDDEN'; end if;
  if v_m.deleted_at is not null then return false; end if;
  update public.chat_messages set deleted_at = now() where id = p_id;
  if v_m.fan_id <> auth.uid() then
    insert into public.admin_actions (channel_id, admin_id, action, target_type, target_id, before)
    values (v_m.channel_id, auth.uid(), 'delete_chat_message', 'chat_message', p_id, jsonb_build_object('fan_id', v_m.fan_id, 'body', v_m.body));
  end if;
  return true;
end $$;
revoke execute on function public.delete_chat_message(uuid) from public, anon;

-- ---------- fans online ----------
-- Real fans count for 10 minutes after their last page load (check_in and post_chat_message stamp last_seen_at).
-- Seeded fans take turns: about 30% read as online in any hour, and the set changes every hour.
create or replace function public.fans_online(p_channel uuid) returns int
language plpgsql stable security definer set search_path = public as $$
declare v_tz text; v_slot text; v_real int; v_seed int;
begin
  select timezone into v_tz from public.channels where id = p_channel;
  if v_tz is null then return 0; end if;
  v_slot := to_char(now() at time zone v_tz, 'YYYY-MM-DD-HH24');
  select count(*) into v_real from public.fans f
    where f.status = 'active' and not f.is_seed and f.last_seen_at >= now() - interval '10 minutes';
  select count(*) into v_seed from public.fans f
    where f.status = 'active' and f.is_seed and ((hashtext(f.id::text || v_slot) & 2147483647) % 100) < 30;
  return v_real + v_seed;
end $$;

-- Supabase's default privileges hand new tables to anon and authenticated wholesale; keep only reads.
revoke truncate, references, trigger on public.chat_messages from anon, authenticated;

-- Signed-in fans ping this from the page every few minutes so FANS ONLINE reflects who is here now.
create or replace function public.touch_presence() returns void
language sql security definer set search_path = public as $$
  update public.fans set last_seen_at = now() where id = auth.uid() and status <> 'banned';
$$;
revoke execute on function public.touch_presence() from public, anon;
