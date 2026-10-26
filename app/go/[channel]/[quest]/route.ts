import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { errorCode } from "@/lib/errors";

/** Visit-link quests pay on the click: log, award, redirect. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ channel: string; quest: string }> }) {
  const { channel, quest } = await params;
  const sb = await createClient();
  const { data, error } = await sb.rpc("record_link_visit", { p_quest: quest });
  const base = new URL(_req.url);
  if (error) {
    const code = errorCode(error);
    if (code === "SIGN_IN_REQUIRED" || code === "NO_FAN") {
      return NextResponse.redirect(new URL(`/${channel}/sign-in?next=${encodeURIComponent(`/go/${channel}/${quest}`)}`, base), 303);
    }
    const { data: q } = await sb.from("quests").select("link_url").eq("id", quest).maybeSingle();
    if (q?.link_url) return NextResponse.redirect(q.link_url, 303);
    return NextResponse.redirect(new URL(`/${channel}?msg=${encodeURIComponent("This link is not available.")}`, base), 303);
  }
  const d = data as { awarded: boolean; xp: number; url: string | null };
  if (!d.url) return NextResponse.redirect(new URL(`/${channel}`, base), 303);
  return NextResponse.redirect(d.url, 303);
}
