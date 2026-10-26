import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getChannel, getViewer, isAdminOf } from "@/lib/data";

export async function GET(_req: Request, { params }: { params: Promise<{ channel: string }> }) {
  const { channel: slug } = await params;
  const channel = await getChannel(slug);
  const { fan } = await getViewer();
  if (!channel || !fan || !(await isAdminOf(channel.id))) return new NextResponse("Forbidden", { status: 403 });
  const sb = await createClient();
  const { data: rows } = await sb.from("email_signups").select("email, consented_at, fans(display_name, newsletter_opt_in)").eq("channel_id", channel.id).order("consented_at");
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const lines = ["email,name,opted_in_at,source"];
  for (const r of rows ?? []) {
    const f = r.fans as { display_name: string | null; newsletter_opt_in: boolean } | null;
    if (f?.newsletter_opt_in === false) continue;
    lines.push([esc(r.email), esc(f?.display_name ?? ""), esc(r.consented_at), esc("quest")].join(","));
  }
  return new NextResponse(lines.join("\n") + "\n", { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${slug}-email-list.csv"` } });
}
