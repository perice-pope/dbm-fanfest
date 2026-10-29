-- 0010: Spotify as a direct, one-click listening source (the EJAE site's model). Last.fm and ListenBrainz stay as fallbacks.

alter table public.listen_accounts drop constraint listen_accounts_service_check;
alter table public.listen_accounts add constraint listen_accounts_service_check check (service in ('spotify', 'lastfm', 'listenbrainz'));
-- For Spotify, username holds the Spotify user id (stable, unique) and display_name what the fan sees.
alter table public.listen_accounts add column if not exists display_name text;
-- OAuth tokens, server-only: the access token is short-lived, the refresh token mints new ones. Never sent to the browser.
alter table public.listen_accounts add column if not exists access_token text;
alter table public.listen_accounts add column if not exists refresh_token text;
alter table public.listen_accounts add column if not exists token_expires_at timestamptz;
revoke select on public.listen_accounts from authenticated;
grant select (fan_id, service, username, display_name, connected_at, last_synced_at) on public.listen_accounts to authenticated;

update public.quests set
  description = 'Connect Spotify with one tap. Every play earns a little XP, and our songs earn more. Not on Spotify? Last.fm works too.'
where type = 'listen' and description like 'Connect Last.fm%';
