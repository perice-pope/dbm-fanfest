import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "../_lib";
import { moveQuest, setQuestStatus } from "../actions";
import { fmtXp } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function QuestsAdmin({ params }: { params: Promise<{ channel: string }> }) {
  const { channel: slug } = await params;
  const { channel } = await requireAdmin(slug);
  const sb = await createClient();
  const { data: quests } = await sb.from("quests").select("*").eq("channel_id", channel.id).order("status").order("sort_order");
  const list = quests ?? [];
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{list.length} quests. Order is the order fans see.</p>
        <Link href={`/${slug}/admin/quests/new`} className="btn btn-primary">New quest</Link>
      </div>
      <ul className="card divide-y divide-line">
        {list.map((q) => (
          <li key={q.id} className="space-y-2 p-3 text-sm">
            <Link href={`/${slug}/admin/quests/${q.id}`} className="block font-medium hover:text-accent">{q.title}</Link>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`label ${q.status === "live" ? "border-success/40 text-success" : q.status === "draft" ? "" : "border-danger/40 text-danger"}`}>{q.status}</span>
              <span className="text-xs text-muted">{q.type} · {fmtXp(q.xp)} XP · {q.repeat_rule}</span>
              <span className="ml-auto flex items-center gap-1">
                {q.status !== "archived" && (
                  <>
                    <form action={moveQuest.bind(null, slug, q.id, -1)}><button className="btn btn-ghost px-2" aria-label="Move up">↑</button></form>
                    <form action={moveQuest.bind(null, slug, q.id, 1)}><button className="btn btn-ghost px-2" aria-label="Move down">↓</button></form>
                  </>
                )}
                {q.status === "live" ? (
                  <form action={setQuestStatus.bind(null, slug, q.id, "archived")}><button className="btn btn-ghost px-2 text-xs">Archive</button></form>
                ) : (
                  <form action={setQuestStatus.bind(null, slug, q.id, "live")}><button className="btn btn-ghost px-2 text-xs">Go live</button></form>
                )}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
