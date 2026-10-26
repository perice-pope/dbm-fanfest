import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "./_lib";
import { fmtXp } from "@/lib/format";
import type { Stats } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AdminHome({ params }: { params: Promise<{ channel: string }> }) {
  const { channel: slug } = await params;
  const { channel } = await requireAdmin(slug);
  const sb = await createClient();
  const [pending, stats, fans, signups] = await Promise.all([
    sb.from("submissions").select("id", { count: "exact", head: true }).eq("channel_id", channel.id).eq("status", "pending"),
    sb.rpc("channel_stats", { p_channel: channel.id }),
    sb.from("fans").select("id", { count: "exact", head: true }),
    sb.from("email_signups").select("id", { count: "exact", head: true }).eq("channel_id", channel.id),
  ]);
  const s = stats.data as Stats | null;
  const tiles = [
    { label: "Waiting for review", value: pending.count ?? 0, href: `/${slug}/admin/review` },
    { label: "XP this week", value: fmtXp(s?.week_xp ?? 0), href: `/${slug}` },
    { label: "Fans with XP", value: s?.fans ?? 0, href: `/${slug}/admin/fans` },
    { label: "Accounts", value: fans.count ?? 0, href: `/${slug}/admin/fans` },
    { label: "Email list", value: signups.count ?? 0, href: `/${slug}/admin/emails` },
    { label: "Live quests", value: s?.quests ?? 0, href: `/${slug}/admin/quests` },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {tiles.map((t) => (
        <Link key={t.label} href={t.href} className="card p-4 hover:bg-surface-2">
          <div className="display text-4xl text-accent">{t.value}</div>
          <div className="mt-1 text-xs uppercase tracking-[0.12em] text-muted">{t.label}</div>
        </Link>
      ))}
    </div>
  );
}
