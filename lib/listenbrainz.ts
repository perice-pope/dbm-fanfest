// Server only: uses the secret-key client. Import from server actions and route handlers, never from a client component.
import type { LbListen } from "@/lib/listen-match";

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
export async function listensAfter(username: string, minTs: number) {
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
