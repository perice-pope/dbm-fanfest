-- DBM FanFest: schema and row-level security
create extension if not exists pgcrypto;

create table public.channels (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  tagline text,
  timezone text not null default 'America/Los_Angeles',
  logo_url text,
  hero_url text,
  links jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.fans (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  normalized_email text not null unique,
  display_name text,
  referral_code text not null unique default encode(gen_random_bytes(5), 'hex'),
  show_on_leaderboard boolean not null default true,
  show_activity boolean not null default true,
  newsletter_opt_in boolean not null default false,
  handles jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active','hidden','banned')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);

create table public.channel_admins (
  channel_id uuid not null references public.channels(id) on delete cascade,
  fan_id uuid not null references public.fans(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (channel_id, fan_id)
);

create table public.quests (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  type text not null check (type in ('daily_visit','visit_link','invite','quiz','poll','weekly_vote','photo_proof','receipt_proof','social_link','social_screenshot','email_signup')),
  title text not null,
  description text,
  xp integer not null default 0 check (xp between 0 and 100000),
  cta_label text,
  link_url text,
  deadline timestamptz,
  repeat_rule text not null default 'once' check (repeat_rule in ('once','daily','weekly','monthly','per_item')),
  lock_min_xp integer not null default 0,
  status text not null default 'live' check (status in ('draft','live','archived')),
  sort_order integer not null default 0,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index quests_channel_idx on public.quests (channel_id, status, sort_order);

-- Correct quiz answers never sit on the readable quest row.
create table public.quiz_answers (
  quest_id uuid not null references public.quests(id) on delete cascade,
  question_index integer not null,
  correct_index integer not null,
  primary key (quest_id, question_index)
);

create table public.xp_ledger (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  fan_id uuid not null references public.fans(id) on delete cascade,
  quest_id uuid references public.quests(id) on delete set null,
  source text not null,
  ref_type text,
  ref_id uuid,
  period_key text not null default '',
  xp integer not null,
  note text,
  created_at timestamptz not null default now()
);
create unique index xp_ledger_once on public.xp_ledger (fan_id, quest_id, period_key) where quest_id is not null and xp > 0;
create index xp_ledger_channel_idx on public.xp_ledger (channel_id, created_at desc);
create index xp_ledger_fan_idx on public.xp_ledger (fan_id, created_at desc);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  fan_id uuid not null references public.fans(id) on delete cascade,
  quest_id uuid not null references public.quests(id) on delete cascade,
  kind text not null check (kind in ('image','link')),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  image_path text,
  file_sha256 text,
  link_url text,
  link_normalized text,
  handle text,
  order_number text,
  caption text,
  consent_featured boolean not null default false,
  consent_rights boolean not null default false,
  featured_at timestamptz,
  hidden_at timestamptz,
  removed_at timestamptz,
  reject_reason text,
  reject_note text,
  reject_mode text check (reject_mode in ('retry','final')),
  reviewer_id uuid references public.fans(id),
  reviewed_at timestamptz,
  xp_awarded boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index submissions_one_pending on public.submissions (fan_id, quest_id) where status = 'pending';
create unique index submissions_link_unique on public.submissions (quest_id, link_normalized) where link_normalized is not null and status <> 'rejected';
create unique index submissions_order_unique on public.submissions (channel_id, order_number) where order_number is not null and status <> 'rejected';
create unique index submissions_file_unique on public.submissions (channel_id, file_sha256) where file_sha256 is not null and status <> 'rejected';
create index submissions_queue_idx on public.submissions (channel_id, status, created_at);
create index submissions_fan_idx on public.submissions (fan_id, quest_id, created_at desc);

create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  type text not null check (type in ('claim','draw')),
  title text not null,
  body text,
  image_url text,
  stock integer,
  delivery_type text not null default 'text' check (delivery_type in ('text','code','link')),
  delivery_payload text,
  draw_ends_at timestamptz,
  winner_fan_id uuid references public.fans(id),
  picked_at timestamptz,
  min_lifetime_xp integer not null default 0,
  status text not null default 'live' check (status in ('draft','live','closed')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create table public.reward_claims (
  reward_id uuid not null references public.rewards(id) on delete cascade,
  fan_id uuid not null references public.fans(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (reward_id, fan_id)
);
create table public.reward_entries (
  reward_id uuid not null references public.rewards(id) on delete cascade,
  fan_id uuid not null references public.fans(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (reward_id, fan_id)
);

create table public.news_items (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  title text not null,
  body text,
  image_url text,
  link_url text,
  link_label text,
  published_at timestamptz not null default now(),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.quest_responses (
  id uuid primary key default gen_random_uuid(),
  quest_id uuid not null references public.quests(id) on delete cascade,
  fan_id uuid not null references public.fans(id) on delete cascade,
  period_key text not null default '',
  answers jsonb not null,
  score integer,
  created_at timestamptz not null default now(),
  unique (quest_id, fan_id, period_key)
);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  code text not null,
  inviter_fan_id uuid not null references public.fans(id) on delete cascade,
  invitee_fan_id uuid not null unique references public.fans(id) on delete cascade,
  flagged boolean not null default false,
  converted_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.email_signups (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  fan_id uuid not null references public.fans(id) on delete cascade,
  email text not null,
  consented_at timestamptz not null default now(),
  unique (channel_id, fan_id)
);

create table public.link_visits (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  fan_id uuid references public.fans(id) on delete set null,
  quest_id uuid references public.quests(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  admin_id uuid references public.fans(id) on delete set null,
  action text not null,
  target_type text,
  target_id uuid,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

-- ---------- helpers ----------
create or replace function public.normalize_email(p_email text) returns text
language plpgsql immutable as $$
declare v_local text; v_domain text;
begin
  v_local := lower(split_part(trim(p_email), '@', 1));
  v_domain := lower(split_part(trim(p_email), '@', 2));
  v_local := split_part(v_local, '+', 1);
  if v_domain in ('gmail.com', 'googlemail.com') then
    v_local := replace(v_local, '.', '');
    v_domain := 'gmail.com';
  end if;
  return v_local || '@' || v_domain;
end $$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.fans (id, email, normalized_email)
  values (new.id, new.email, public.normalize_email(new.email))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin(p_channel uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.channel_admins where channel_id = p_channel and fan_id = auth.uid());
$$;

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create trigger quests_touch before update on public.quests for each row execute function public.touch_updated_at();

-- ---------- row-level security ----------
alter table public.channels enable row level security;
alter table public.fans enable row level security;
alter table public.channel_admins enable row level security;
alter table public.quests enable row level security;
alter table public.quiz_answers enable row level security;
alter table public.xp_ledger enable row level security;
alter table public.submissions enable row level security;
alter table public.rewards enable row level security;
alter table public.reward_claims enable row level security;
alter table public.reward_entries enable row level security;
alter table public.news_items enable row level security;
alter table public.quest_responses enable row level security;
alter table public.invites enable row level security;
alter table public.email_signups enable row level security;
alter table public.link_visits enable row level security;
alter table public.admin_actions enable row level security;

create policy "channels readable" on public.channels for select using (true);
create policy "channels admin update" on public.channels for update using (public.is_admin(id)) with check (public.is_admin(id));

create policy "fans read own" on public.fans for select using (auth.uid() = id);
create policy "fans admin read" on public.fans for select using (exists (select 1 from public.channel_admins a where a.fan_id = auth.uid()));
create policy "fans update own" on public.fans for update using (auth.uid() = id) with check (auth.uid() = id);
revoke update on public.fans from authenticated;
grant update (display_name, show_on_leaderboard, show_activity, newsletter_opt_in, handles) on public.fans to authenticated;

create policy "admins read own rows" on public.channel_admins for select using (fan_id = auth.uid() or public.is_admin(channel_id));

create policy "quests read live" on public.quests for select using (status = 'live' or public.is_admin(channel_id));
create policy "quests admin write" on public.quests for all using (public.is_admin(channel_id)) with check (public.is_admin(channel_id));

create policy "quiz answers admin" on public.quiz_answers for all
  using (public.is_admin((select channel_id from public.quests q where q.id = quest_id)))
  with check (public.is_admin((select channel_id from public.quests q where q.id = quest_id)));

create policy "ledger read own" on public.xp_ledger for select using (fan_id = auth.uid() or public.is_admin(channel_id));

create policy "submissions read own" on public.submissions for select using (fan_id = auth.uid() or public.is_admin(channel_id));

create policy "rewards read live" on public.rewards for select using (status in ('live','closed') or public.is_admin(channel_id));
create policy "rewards admin write" on public.rewards for all using (public.is_admin(channel_id)) with check (public.is_admin(channel_id));
create policy "claims read own" on public.reward_claims for select using (fan_id = auth.uid() or public.is_admin((select channel_id from public.rewards r where r.id = reward_id)));
create policy "entries read own" on public.reward_entries for select using (fan_id = auth.uid() or public.is_admin((select channel_id from public.rewards r where r.id = reward_id)));

create policy "news read active" on public.news_items for select using (is_active or public.is_admin(channel_id));
create policy "news admin write" on public.news_items for all using (public.is_admin(channel_id)) with check (public.is_admin(channel_id));

create policy "responses read own" on public.quest_responses for select using (fan_id = auth.uid() or public.is_admin((select channel_id from public.quests q where q.id = quest_id)));

create policy "invites admin read" on public.invites for select using (public.is_admin(channel_id));
create policy "signups read" on public.email_signups for select using (fan_id = auth.uid() or public.is_admin(channel_id));
create policy "visits admin read" on public.link_visits for select using (public.is_admin(channel_id));
create policy "actions admin read" on public.admin_actions for select using (public.is_admin(channel_id));
create policy "actions admin insert" on public.admin_actions for insert with check (public.is_admin(channel_id) and admin_id = auth.uid());
