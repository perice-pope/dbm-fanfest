import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { errorCode } from "@/lib/errors";
import { isSlug, isUuid } from "@/lib/safe-next";

/** Visit-link quests pay on the click: log, award, redirect. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ channel: string; quest: string }> }) {
  const { channel, quest } = await params;
  if (!isSlug(channel) || !isUuid(quest)) return new NextResponse("Not found", { status: 404 });
  const base = new URL(req.url);
  const sb = await createClient();
  const { data, error } = await sb.rpc("record_link_visit", { p_quest: quest });
  if (error) {
    const code = errorCode(error);
    if (code === "SIGN_IN_REQUIRED" || code === "NO_FAN") {
      return NextResponse.redirect(new URL(`/${channel}/sign-in?next=${encodeURIComponent(`/go/${channel}/${quest}`)}`, base), 303);
    }
    const { data: q } = await sb.from("quests").select("link_url").eq("id", quest).maybeSingle();
    if (q?.link_url && /^https?:\/\//i.test(q.link_url)) return NextResponse.redirect(q.link_url, 303);
    return NextResponse.redirect(new URL(`/${channel}?msg=link_unavailable`, base), 303);
  }
  const d = data as { awarded: boolean; xp: number; url: string | null };
  if (!d.url || !/^https?:\/\//i.test(d.url)) return NextResponse.redirect(new URL(`/${channel}`, base), 303);
  return NextResponse.redirect(d.url, 303);
}
