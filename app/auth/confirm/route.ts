import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Email landing. Handles both link styles Supabase can send:
 * - token_hash + type (custom template, works on any device)
 * - code (default template, PKCE, must be opened on the device that requested it)
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const token_hash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/";
  const dest = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const slug = dest.split("/")[1] || "destroyedbymoths";
  const sb = await createClient();
  let ok = false;
  if (token_hash && type) ok = !(await sb.auth.verifyOtp({ type, token_hash })).error;
  else if (code) ok = !(await sb.auth.exchangeCodeForSession(code)).error;
  if (ok) {
    const { data: { user } } = await sb.auth.getUser();
    const { data: fan } = user ? await sb.from("fans").select("display_name").eq("id", user.id).maybeSingle() : { data: null };
    if (user && !fan?.display_name) return NextResponse.redirect(new URL(`/${slug}/account?first=1&next=${encodeURIComponent(dest)}`, url), 303);
    return NextResponse.redirect(new URL(dest, url), 303);
  }
  return NextResponse.redirect(new URL(`/${slug}/sign-in?error=link`, url), 303);
}
