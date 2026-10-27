// Server only: uses the secret-key client. Import from server actions and route handlers, never from a client component.
import { createAdminClient } from "@/lib/supabase/server";
import { bandPlays, type LbListen, type ListenConfig } from "@/lib/listen-match";

const API = "https://api.listenbrainz.org/1";
const UA = "DBM-FanFest/1.0 (+https://dbm-fanfest.vercel.app)";
const PAGE = 100;
const MAX_PAGES = 5;

async function lb(path: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, { ...init, headers: { "User-Agent": UA, ...(init?.headers ?? {}) }, cache: "no-store", signal: AbortSignal.timeout(10_000) });
  // ListenBrainz allows about 30 calls per 10 s per IP; when the window is spent, wait it out once.
  if (res.status === 429) throw new Error("LB_DOWN");
  const left = Number(res.headers.get("x-ratelimit-remaining") ?? "1");
  const resetIn = Number(res.headers.get("x-ratelimit-reset-in") ?? "0");
  if (left <= 0 && resetIn > 0 && resetIn <= 10) await new Promise((r) => setTimeout(r, resetIn * 1000));
  return res;
}

/** Checks a fan's ListenBrainz user token and returns the username it belongs to. The token is not kept. */
export async function validateToken(token: string): Promise<string> {
  const t = token.trim();
  if (!/^[0-9a-f-]{36}$/i.test(t)) throw new Error("LB_BAD_TOKEN");
  let res: Response;
  try { res = await lb("/validate-token", { headers: { Authorization: `Token ${t}` } }); } catch { throw new Error("LB_DOWN"); }
  if (!res.ok) throw new Error(res.status >= 500 ? "LB_DOWN" : "LB_BAD_TOKEN");
  const body = (await res.json()) as { valid?: boolean; user_name?: string };
  if (!body.valid || !body.user_name) throw new Error("LB_BAD_TOKEN");
  return body.user_name;
}

/** Listens strictly after minTs, oldest first, at most MAX_PAGES pages. ListenBrainz returns the earliest window after min_ts. */
async function listensAfter(username: string, minTs: number) {
  const out: LbListen[] = [];
  let cursor = minTs;
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await lb(`/user/${encodeURIComponent(username)}/listens?count=${PAGE}&min_ts=${cursor}`);
    if (res.status === 404) throw new Error("LB_USER_GONE");
    if (!res.ok) throw new Error("LB_DOWN");
    const listens = ((await res.json()) as { payload: { listens: LbListen[] } }).payload.listens ?? [];
    if (listens.length === 0) break;
    out.push(...listens);
    cursor = Math.max(cursor, ...listens.map((l) => l.listened_at));
    if (listens.length < PAGE) break;
  }
  return { listens: out, cursor };
}

export type SyncResult = { awarded: number; xp: number; capped: number; checked: number };

/** Reads a fan's new plays, pays the band's through award_listens and moves the fan's cursor. Runs with the secret key. */
export async function syncFan(fanId: string, questId: string, opts: { allowDraft?: boolean } = {}): Promise<SyncResult> {
  const sb = createAdminClient();
  const [{ data: acc }, { data: quest }] = await Promise.all([
    sb.from("listen_accounts").select("*").eq("fan_id", fanId).maybeSingle(),
    sb.from("quests").select("id, config, channel_id, channels(name)").eq("id", questId).single(),
  ]);
  if (!acc) throw new Error("NOT_CONNECTED");
  if (!quest) throw new Error("QUEST_UNAVAILABLE");
  const since = Math.max(acc.cursor_ts, Math.floor(new Date(acc.connected_at).getTime() / 1000));
  const { listens, cursor } = await listensAfter(acc.username, since);
  const cfg = (quest.config ?? {}) as ListenConfig;
  const bandName = (quest.channels as { name: string } | null)?.name ?? "";
  const plays = bandPlays(listens, cfg, bandName);
  let result = { awarded: 0, xp: 0, capped: 0 };
  if (plays.length) {
    const { data, error } = await sb.rpc("award_listens", { p_quest: questId, p_fan: fanId, p_plays: plays, p_allow_draft: !!opts.allowDraft });
    if (error) throw error;
    result = data as typeof result;
  }
  await sb.from("listen_accounts").update({ cursor_ts: cursor, last_synced_at: new Date().toISOString() }).eq("fan_id", fanId);
  return { ...result, checked: listens.length };
}
