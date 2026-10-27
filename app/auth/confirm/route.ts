import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNext, slugFromPath } from "@/lib/safe-next";

/**
 * Email landing. Handles both link styles Supabase can send:
 * - token_hash + type (custom template, works on any device)
 * - code (default template, PKCE, must be opened on the device that requested it)
 * Also attaches a referral cookie to a brand-new account, like the code path does.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const token_hash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const code = url.searchParams.get("code");
  const dest = safeNext("destroyedbymoths", url.searchParams.get("next"), url.origin);
  const slug = slugFromPath(dest);
  const sb = await createClient();
  let ok = false;
  if (token_hash && type) ok = !(await sb.auth.verifyOtp({ type, token_hash })).error;
  else if (code) ok = !(await sb.auth.exchangeCodeForSession(code)).error;
  if (!ok) return NextResponse.redirect(new URL(`/${slug}/sign-in?error=link`, url), 303);

  const { data: { user } } = await sb.auth.getUser();
  const ref = request.cookies.get("ff_ref")?.value;
  if (ref && user) {
    const { data: ch } = await sb.from("channels").select("id").eq("slug", slug).maybeSingle();
    if (ch) await sb.rpc("attach_invite", { p_channel: ch.id, p_code: ref });
  }
  const { data: fan } = user ? await sb.from("fans").select("display_name").eq("id", user.id).maybeSingle() : { data: null };
  const target = user && !fan?.display_name ? `/${slug}/account?first=1&next=${encodeURIComponent(dest)}` : dest;
  const res = NextResponse.redirect(new URL(target, url), 303);
  if (ref) res.cookies.delete("ff_ref");
  return res;
}
