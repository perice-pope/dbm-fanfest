import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { exchangeCode, me } from "@/lib/spotify";
import { errorCode } from "@/lib/errors";

export const dynamic = "force-dynamic";

/** Spotify sends the fan back here with a one-time code; it becomes tokens on the fan's listening account. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const jar = await cookies();
  const saved = jar.get("sp_state")?.value ?? "";
  jar.delete("sp_state");
  const [state, slug, quest] = saved.split(":");
  if (!state || !slug || !quest) return NextResponse.redirect(new URL("/", url.origin));
  const back = new URL(`/${slug}/q/${quest}`, url.origin);
  const fail = (code: string) => { back.searchParams.set("spotify_error", code); return NextResponse.redirect(back); };
  if (url.searchParams.get("state") !== state) return fail("SP_BAD_TOKEN");
  // The fan pressed Cancel on Spotify's page.
  if (url.searchParams.get("error")) return fail("SP_DENIED");
  const code = url.searchParams.get("code");
  if (!code) return fail("SP_BAD_TOKEN");
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (!user) return NextResponse.redirect(new URL(`/${slug}/sign-in?next=${encodeURIComponent(back.pathname)}`, url.origin));
  try {
    const tokens = await exchangeCode(code, `${url.origin}/api/spotify/callback`);
    const profile = await me(tokens.access_token);
    const sb = createAdminClient();
    const { data: fan } = await sb.from("fans").select("status").eq("id", user.id).single();
    if (fan?.status === "banned") return fail("BANNED");
    const { data: existing } = await sb.from("listen_accounts").select("service, username").eq("fan_id", user.id).maybeSingle();
    const same = existing?.service === "spotify" && existing.username === profile.id;
    const creds = {
      display_name: profile.displayName,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    };
    // Relinking the same account keeps its start time and refreshes the tokens; a different account starts counting from now.
    const { error } = same
      ? await sb.from("listen_accounts").update(creds).eq("fan_id", user.id)
      : await sb.from("listen_accounts").upsert(
          { fan_id: user.id, service: "spotify", username: profile.id, session_key: null, connected_at: new Date().toISOString(), cursor_ts: 0, last_synced_at: null, ...creds },
          { onConflict: "fan_id" },
        );
    if (error) return fail(error.code === "23505" ? "SP_TAKEN" : "SP_DOWN");
    back.searchParams.set("spotify", "connected");
    return NextResponse.redirect(back);
  } catch (e) {
    return fail(errorCode(e) ?? "SP_DOWN");
  }
}
