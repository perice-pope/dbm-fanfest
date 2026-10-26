"use client";
import { useState } from "react";
import Link from "next/link";
import { fmtXp } from "@/lib/format";
import type { BoardRow, MyRank, Period } from "@/lib/data";

const LABELS: Record<Period, string> = { weekly: "Weekly", monthly: "Monthly", lifetime: "Lifetime" };

export function Leaderboard({
  slug, boards, ranks, signedIn, displayName,
}: { slug: string; boards: Record<Period, BoardRow[]>; ranks: Record<Period, MyRank>; signedIn: boolean; displayName: string | null }) {
  const [period, setPeriod] = useState<Period>("weekly");
  const rows = boards[period];
  const mine = ranks[period];
  const inTop = mine?.rank != null && rows.some((r) => r.rank === mine.rank && r.display_name === (displayName ?? "A fan"));
  return (
    <section id="leaderboard" className="card p-4 sm:p-5" aria-label="Leaderboard">
      <div className="flex items-center justify-between gap-3">
        <h2 className="display text-2xl">{LABELS[period]} leaderboard</h2>
        <Link href={`/${slug}/leaderboard?period=${period}`} className="text-xs uppercase tracking-[0.12em] text-muted hover:text-text">View all</Link>
      </div>
      <div className="seg mt-3" role="group" aria-label="Period">
        {(Object.keys(LABELS) as Period[]).map((p) => (
          <button key={p} type="button" aria-pressed={period === p} onClick={() => setPeriod(p)}>{LABELS[p]}</button>
        ))}
      </div>
      <ol className="mt-4 divide-y divide-line">
        {rows.length === 0 && <li className="py-6 text-center text-sm text-muted">No XP yet this {period === "lifetime" ? "season" : period === "weekly" ? "week" : "month"}. Be first.</li>}
        {rows.map((r) => (
          <li key={r.fan_id} className="flex items-center gap-3 py-3">
            <span className="display w-8 text-2xl text-accent">{r.rank}</span>
            <span className="flex-1 truncate font-medium">{r.display_name}</span>
            <span className="display text-xl">{fmtXp(r.xp)}</span>
          </li>
        ))}
      </ol>
      <div className="mt-3 border-t border-line pt-3 text-sm">
        {!signedIn && <Link href={`/${slug}/sign-in`} className="text-muted hover:text-text">Sign up to see your rank</Link>}
        {signedIn && mine?.hidden && <span className="text-muted">Hidden from leaderboard · {fmtXp(mine.xp)} XP</span>}
        {signedIn && mine && !mine.hidden && mine.rank == null && <span className="text-muted">No XP yet this {period === "lifetime" ? "season" : period === "weekly" ? "week" : "month"}</span>}
        {signedIn && mine && !mine.hidden && mine.rank != null && !inTop && (
          <div className="flex items-center gap-3">
            <span className="display w-8 text-2xl text-accent">{mine.rank}</span>
            <span className="flex-1 truncate font-medium">{displayName ?? "You"} <span className="text-muted">(you)</span></span>
            <span className="display text-xl">{fmtXp(mine.xp)}</span>
          </div>
        )}
        {signedIn && mine && !mine.hidden && mine.rank != null && inTop && <span className="text-muted">You are #{mine.rank} · {fmtXp(mine.xp)} XP</span>}
      </div>
    </section>
  );
}
