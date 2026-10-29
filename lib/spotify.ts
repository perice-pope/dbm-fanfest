// Server only: holds the Spotify client secret. Import from route handlers, server actions and lib/listen-sync, never from a client component.
// Mirrors the EJAE site's lib/spotify.js: authorize, swap the code for tokens, refresh, read recently played.

const ACCOUNTS = "https://accounts.spotify.com";
const API = "https://api.spotify.com/v1";
// Least privilege: recently-played is the only thing the quest reads. /me works without extra scopes for id and display name.
const SCOPES = "user-read-recently-played";

export function spotifyConfigured() {
  return !!(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
}

/** Spotify's approval page. `redirect` must match one of the redirect URIs registered on the Spotify app, exactly. */
export function spotifyAuthUrl(state: string, redirect: string) {
  const u = new URL(`${ACCOUNTS}/authorize`);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", process.env.SPOTIFY_CLIENT_ID!);
  u.searchParams.set("scope", SCOPES);
  u.searchParams.set("redirect_uri", redirect);
  u.searchParams.set("state", state);
  return u.toString();
}

export type SpotifyTokens = { access_token: string; refresh_token?: string; expires_in: number; scope?: string };

async function tokenCall(body: Record<string, string>): Promise<SpotifyTokens> {
  const auth = Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString("base64");
  let res: Response;
  try {
    res = await fetch(`${ACCOUNTS}/api/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${auth}` },
      body: new URLSearchParams(body),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch { throw new Error("SP_DOWN"); }
  const data = (await res.json().catch(() => ({}))) as SpotifyTokens & { error?: string };
  // invalid_grant: the code was used or the fan revoked access, so the link has to be made again.
  if (res.status === 400 || res.status === 401) throw new Error("SP_BAD_TOKEN");
  if (!res.ok) throw new Error("SP_DOWN");
  return data;
}

/** Swaps the callback code for tokens. The redirect must be the one the authorize step used. */
export function exchangeCode(code: string, redirect: string) {
  return tokenCall({ grant_type: "authorization_code", code, redirect_uri: redirect });
}

export function refreshTokens(refreshToken: string) {
  return tokenCall({ grant_type: "refresh_token", refresh_token: refreshToken });
}

async function api<T>(path: string, accessToken: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store", signal: AbortSignal.timeout(10_000) });
  } catch { throw new Error("SP_DOWN"); }
  if (res.status === 401) throw new Error("SP_BAD_TOKEN");
  // 403 while the Spotify app is in development mode: this fan is not on its user allowlist yet.
  if (res.status === 403) throw new Error("SP_NOT_ALLOWED");
  if (!res.ok) throw new Error("SP_DOWN");
  return (await res.json()) as T;
}

export async function me(accessToken: string) {
  const u = await api<{ id: string; display_name?: string | null }>("/me", accessToken);
  return { id: u.id, displayName: (u.display_name ?? "").trim() || u.id };
}

export type SpotifyPlay = { track: string; artists: string[]; listened_at: number };

type RecentItem = { track: { name: string; artists: { name: string }[] }; played_at: string };

/**
 * Plays after `from` (unix seconds), oldest first. Spotify keeps the last 50 plays only, so a fan who streams
 * all day between checks loses some; the hourly cron and the once-a-minute page check keep that rare.
 */
export async function recentlyPlayed(accessToken: string, from: number): Promise<{ plays: SpotifyPlay[]; cursor: number }> {
  const after = Math.max(0, from) * 1000;
  const data = await api<{ items?: RecentItem[] }>(`/me/player/recently-played?limit=50${after ? `&after=${after}` : ""}`, accessToken);
  const plays = (data.items ?? [])
    .map((i) => ({ track: i.track?.name?.trim() ?? "", artists: (i.track?.artists ?? []).map((a) => a.name), listened_at: Math.floor(new Date(i.played_at).getTime() / 1000) }))
    .filter((p) => p.track && Number.isFinite(p.listened_at) && p.listened_at > from)
    .sort((a, b) => a.listened_at - b.listened_at);
  const cursor = plays.length ? plays[plays.length - 1].listened_at : from;
  return { plays, cursor };
}
