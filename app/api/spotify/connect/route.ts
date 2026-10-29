import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { spotifyAuthUrl, spotifyConfigured } from "@/lib/spotify";
import { isSlug, isUuid } from "@/lib/safe-next";

export const dynamic = "force-dynamic";

/** Starts the Spotify link: a signed-in fan is sent to Spotify to approve, then back to /api/spotify/callback. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug") ?? "";
  const quest = url.searchParams.get("quest") ?? "";
  if (!isSlug(slug) || !isUuid(quest)) return NextResponse.redirect(new URL("/", url.origin));
  const back = `/${slug}/q/${quest}`;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.redirect(new URL(`/${slug}/sign-in?next=${encodeURIComponent(back)}`, url.origin));
  if (!spotifyConfigured()) return NextResponse.redirect(new URL(`${back}?spotify_error=SP_NOT_CONFIGURED`, url.origin));
  // The callback trusts only a request that carries this cookie, and only for the quest it was started from.
  const state = randomBytes(16).toString("hex");
  (await cookies()).set("sp_state", `${state}:${slug}:${quest}`, { httpOnly: true, sameSite: "lax", secure: url.protocol === "https:", path: "/", maxAge: 600 });
  // The redirect derives from the request, so it must be registered on the Spotify app for each host (production and 127.0.0.1 for dev).
  return NextResponse.redirect(spotifyAuthUrl(state, `${url.origin}/api/spotify/callback`));
}
