import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { lastfmAuthUrl, lastfmConfigured } from "@/lib/lastfm";
import { isSlug, isUuid } from "@/lib/safe-next";

export const dynamic = "force-dynamic";

/** Starts the Last.fm link: a signed-in fan is sent to Last.fm to approve, then back to /api/lastfm/callback. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug") ?? "";
  const quest = url.searchParams.get("quest") ?? "";
  if (!isSlug(slug) || !isUuid(quest)) return NextResponse.redirect(new URL("/", url.origin));
  const back = `/${slug}/q/${quest}`;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.redirect(new URL(`/${slug}/sign-in?next=${encodeURIComponent(back)}`, url.origin));
  if (!lastfmConfigured()) return NextResponse.redirect(new URL(`${back}?lastfm_error=LFM_NOT_CONFIGURED`, url.origin));
  // The callback trusts only a request that carries this cookie, and only for the quest it was started from.
  const state = randomBytes(16).toString("hex");
  (await cookies()).set("lfm_state", `${state}:${slug}:${quest}`, { httpOnly: true, sameSite: "lax", secure: url.protocol === "https:", path: "/", maxAge: 600 });
  // Redirects derive from the request, so previews and localhost work without extra config.
  return NextResponse.redirect(lastfmAuthUrl(`${url.origin}/api/lastfm/callback?state=${state}`));
}
