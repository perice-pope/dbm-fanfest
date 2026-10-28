import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/lastfm";
import { errorCode } from "@/lib/errors";

export const dynamic = "force-dynamic";

/** Last.fm sends the fan back here with a one-time token; it becomes a username and session key on the fan's listening account. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const jar = await cookies();
  const saved = jar.get("lfm_state")?.value ?? "";
  jar.delete("lfm_state");
  const [state, slug, quest] = saved.split(":");
  if (!state || !slug || !quest) return NextResponse.redirect(new URL("/", url.origin));
  const back = new URL(`/${slug}/q/${quest}`, url.origin);
  const fail = (code: string) => { back.searchParams.set("lastfm_error", code); return NextResponse.redirect(back); };
  if (url.searchParams.get("state") !== state) return fail("LFM_BAD_TOKEN");
  const token = url.searchParams.get("token");
  if (!token) return fail("LFM_BAD_TOKEN");
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (!user) return NextResponse.redirect(new URL(`/${slug}/sign-in?next=${encodeURIComponent(back.pathname)}`, url.origin));
  try {
    const { username, sessionKey } = await getSession(token);
    const sb = createAdminClient();
    const { data: fan } = await sb.from("fans").select("status").eq("id", user.id).single();
    if (fan?.status === "banned") return fail("BANNED");
    const { data: existing } = await sb.from("listen_accounts").select("service, username").eq("fan_id", user.id).maybeSingle();
    const same = existing?.service === "lastfm" && existing.username.toLowerCase() === username.toLowerCase();
    // Relinking the same account keeps its start time and refreshes the key; a different account starts counting from now.
    const row = same
      ? { session_key: sessionKey }
      : { fan_id: user.id, service: "lastfm", username, session_key: sessionKey, connected_at: new Date().toISOString(), cursor_ts: 0, last_synced_at: null };
    const { error } = same
      ? await sb.from("listen_accounts").update(row).eq("fan_id", user.id)
      : await sb.from("listen_accounts").upsert(row as Required<typeof row>, { onConflict: "fan_id" });
    if (error) return fail(error.code === "23505" ? "LFM_TAKEN" : "LFM_DOWN");
    back.searchParams.set("lastfm", "connected");
    return NextResponse.redirect(back);
  } catch (e) {
    return fail(errorCode(e) ?? "LFM_DOWN");
  }
}
