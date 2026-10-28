// Server only: holds the Last.fm shared secret. Import from route handlers and server actions, never from a client component.
import { createHash } from "node:crypto";
import type { Play } from "@/lib/listen-match";

const API = "https://ws.audioscrobbler.com/2.0/";
const UA = "DBM-FanFest/1.0 (+https://dbm-fanfest.vercel.app)";

export function lastfmConfigured() {
  return !!(process.env.LASTFM_API_KEY && process.env.LASTFM_SHARED_SECRET);
}

/** Where a fan goes to approve the link; Last.fm sends them back to cb with a one-time token. */
export function lastfmAuthUrl(callback: string) {
  const u = new URL("https://www.last.fm/api/auth/");
  u.searchParams.set("api_key", process.env.LASTFM_API_KEY!);
  u.searchParams.set("cb", callback);
  return u.toString();
}

/** api_sig: parameters sorted by name, concatenated name+value, plus the shared secret, md5. */
export function sign(params: Record<string, string>, secret = process.env.LASTFM_SHARED_SECRET!) {
  const base = Object.keys(params).filter((k) => k !== "format" && k !== "callback").sort().map((k) => k + params[k]).join("");
  return createHash("md5").update(base + secret, "utf8").digest("hex");
}

type LfmError = { error?: number; message?: string };

async function call<T>(params: Record<string, string>, opts: { signed?: boolean; post?: boolean } = {}): Promise<T> {
  const p: Record<string, string> = { ...params, api_key: process.env.LASTFM_API_KEY! };
  if (opts.signed) p.api_sig = sign(p);
  p.format = "json";
  const body = new URLSearchParams(p);
  let res: Response;
  try {
    res = opts.post
      ? await fetch(API, { method: "POST", body, headers: { "User-Agent": UA }, cache: "no-store", signal: AbortSignal.timeout(10_000) })
      : await fetch(`${API}?${body}`, { headers: { "User-Agent": UA }, cache: "no-store", signal: AbortSignal.timeout(10_000) });
  } catch { throw new Error("LFM_DOWN"); }
  const data = (await res.json().catch(() => ({}))) as T & LfmError;
  if (data.error) {
    // 6 = invalid parameters (unknown user), 17 = recent listening hidden, 29 = rate limit, 4/14/15 = bad token.
    if (data.error === 17) throw new Error("LFM_PRIVATE");
    if (data.error === 6) throw new Error("LFM_USER_GONE");
    if (data.error === 29 || data.error === 8 || data.error === 11 || data.error === 16) throw new Error("LFM_DOWN");
    if (data.error === 4 || data.error === 14 || data.error === 15) throw new Error("LFM_BAD_TOKEN");
    throw new Error(`LFM_${data.error}`);
  }
  if (!res.ok) throw new Error("LFM_DOWN");
  return data;
}

/** Swaps the callback token for the fan's Last.fm username and a session key that does not expire. */
export async function getSession(token: string) {
  const data = await call<{ session: { name: string; key: string } }>({ method: "auth.getSession", token }, { signed: true });
  return { username: data.session.name, sessionKey: data.session.key };
}

export type LfmTrack = { name: string; artist: { "#text": string; mbid?: string }; date?: { uts: string }; "@attr"?: { nowplaying?: string } };

/** Plays after `from` (unix seconds), oldest first. The session key lets us read a fan whose recent listening is hidden. */
export async function recentTracks(username: string, from: number, sessionKey?: string | null): Promise<{ plays: (Play & { artist: string; artistMbid?: string })[]; cursor: number }> {
  const params: Record<string, string> = { method: "user.getRecentTracks", user: username, limit: "200", from: String(Math.max(0, from)) };
  if (sessionKey) params.sk = sessionKey;
  const data = await call<{ recenttracks: { track: LfmTrack[] | LfmTrack } }>(params, { signed: !!sessionKey });
  const raw = data.recenttracks?.track ?? [];
  const list = Array.isArray(raw) ? raw : [raw];
  const plays = list
    .filter((t) => !t["@attr"]?.nowplaying && t.date?.uts)
    .map((t) => ({ track: t.name.trim(), artist: t.artist["#text"], artistMbid: t.artist.mbid || undefined, listened_at: Number(t.date!.uts) }))
    .filter((p) => p.track && Number.isFinite(p.listened_at) && p.listened_at > from)
    .sort((a, b) => a.listened_at - b.listened_at);
  const cursor = plays.length ? plays[plays.length - 1].listened_at : from;
  return { plays, cursor };
}
