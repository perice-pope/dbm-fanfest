import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "./_lib";

const NAV = [
  ["", "Overview"], ["/review", "Review"], ["/uploads", "Uploads"], ["/quests", "Quests"], ["/news", "News"], ["/rewards", "Rewards"], ["/fans", "Fans"], ["/emails", "Email list"], ["/settings", "Settings"],
] as const;

export default async function AdminLayout({ children, params }: { children: React.ReactNode; params: Promise<{ channel: string }> }) {
  const { channel: slug } = await params;
  const { channel } = await requireAdmin(slug);
  const sb = await createClient();
  const { count } = await sb.from("submissions").select("id", { count: "exact", head: true }).eq("channel_id", channel.id).eq("status", "pending");
  return (
    <div className="mx-auto max-w-[1440px] space-y-5 px-[24px] pt-[24px]">
      <div className="flex items-center justify-between">
        <h2 className="display text-3xl">Admin</h2>
        <span className="text-xs text-muted">{channel.name}</span>
      </div>
      <nav className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4" aria-label="Admin sections">
        {NAV.map(([path, label]) => (
          <Link key={path} href={`/${slug}/admin${path}`} className="label whitespace-nowrap hover:border-accent hover:text-text">
            {label}{path === "/review" && count ? ` · ${count}` : ""}
          </Link>
        ))}
      </nav>
      <div>{children}</div>
    </div>
  );
}
