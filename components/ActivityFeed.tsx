"use client";
import { useState } from "react";
import { fmtXp, timeAgo } from "@/lib/format";
import type { FeedRow, Stats } from "@/lib/data";

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

export function ActivityFeed({ feed, stats, todayIndex }: { feed: FeedRow[]; stats: Stats; todayIndex: number }) {
  const [open, setOpen] = useState(false);
  const max = Math.max(1, ...stats.days);
  const shown = open ? feed : feed.slice(0, 5);
  return (
    <section id="activity" className="card p-4 sm:p-5" aria-label="Recent activity">
      <h2 className="display text-2xl">Recent activity</h2>
      <div className="mt-3 flex items-end justify-between gap-4">
        <div>
          <div className="display text-4xl text-accent">{fmtXp(stats.week_xp)}</div>
          <div className="text-xs uppercase tracking-[0.12em] text-muted">XP earned by fans this week</div>
        </div>
        <div className="flex items-end gap-1.5" aria-label="XP by day this week">
          {stats.days.map((v, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className="w-3 rounded-sm bg-line" style={{ height: 28 }}>
                <div className={`w-3 rounded-sm ${i === todayIndex ? "bg-accent" : "bg-muted"}`} style={{ height: Math.max(2, Math.round((v / max) * 28)), marginTop: 28 - Math.max(2, Math.round((v / max) * 28)) }} />
              </div>
              <span className={`text-[10px] ${i === todayIndex ? "text-accent" : "text-muted"}`}>{DAYS[i]}</span>
            </div>
          ))}
        </div>
      </div>
      <ul className="mt-4 divide-y divide-line">
        {feed.length === 0 && <li className="py-5 text-center text-sm text-muted">No activity yet. Complete a quest to start the feed.</li>}
        {shown.map((f) => (
          <li key={f.id} className="flex items-center gap-3 py-2.5 text-sm">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold uppercase">{f.display_name.slice(0, 1)}</span>
            <span className="flex-1 truncate"><span className="font-medium">{f.display_name}</span> <span className="text-muted">{f.note ?? f.source.replace(/_/g, " ")}</span></span>
            <span className="text-xs text-muted">{timeAgo(f.created_at)}</span>
            <span className="badge-xp">+{fmtXp(f.xp)} XP</span>
          </li>
        ))}
      </ul>
      {feed.length > 5 && (
        <button type="button" className="mt-2 w-full text-xs uppercase tracking-[0.12em] text-muted hover:text-text" onClick={() => setOpen((o) => !o)}>
          {open ? "Show less" : `Show all ${feed.length}`}
        </button>
      )}
    </section>
  );
}
