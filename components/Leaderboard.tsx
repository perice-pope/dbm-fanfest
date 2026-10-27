"use client";
import { useState } from "react";
import Link from "next/link";
import { fmtXp } from "@/lib/format";
import { useJoin } from "@/components/JoinModal";
import type { BoardRow, MyRank, Period } from "@/lib/data";

const LABELS: Record<Period, string> = { weekly: "Weekly", monthly: "Monthly", lifetime: "Lifetime" };
const ORDER: Period[] = ["weekly", "monthly", "lifetime"];

export function Leaderboard({ slug, boards, ranks, signedIn, fanId }: { slug: string; boards: Record<Period, BoardRow[]>; ranks: Record<Period, MyRank>; signedIn: boolean; fanId: string | null }) {
  const [period, setPeriod] = useState<Period>("monthly");
  const { open } = useJoin();
  const rows = boards[period].slice(0, 3);
  const mine = ranks[period];
  const inTop = !!fanId && rows.some((r) => r.fan_id === fanId);
  const rankLine = !signedIn ? (
    <button type="button" className="text-[16px] leading-none hover:underline" onClick={() => open(`/${slug}#leaderboard`)}>Sign up to see your rank</button>
  ) : mine?.hidden ? (
    <span className="text-[16px] leading-none">Hidden from leaderboard · {fmtXp(mine.xp)} XP</span>
  ) : mine?.rank == null ? (
    <span className="text-[16px] leading-none">No XP yet</span>
  ) : inTop ? (
    <span className="text-[16px] leading-none">You are #{mine.rank}</span>
  ) : (
    <span className="text-[16px] leading-none">#{mine.rank} · {fmtXp(mine.xp)} XP</span>
  );

  return (
    <section id="leaderboard" aria-label="Leaderboard" className="fig-card relative h-[371px] scroll-mt-4 px-[16px] pt-[20px]">
      <div className="flex items-start justify-between">
        <h2 className="text-[24px] leading-none lg:text-[32px]">{LABELS[period]} Leaderboard</h2>
        <Link href={`/${slug}/leaderboard?period=${period}`} className="mt-[6px] hidden text-[16px] leading-none hover:underline lg:block">View All</Link>
      </div>
      <div className="fig-seg mt-[22px] max-lg:mt-[22px]" role="group" aria-label="Period">
        {ORDER.map((p) => (
          <button key={p} type="button" aria-pressed={period === p} onClick={() => setPeriod(p)}>{LABELS[p]}</button>
        ))}
      </div>
      <ol className="mt-0">
        {rows.length === 0 && <li className="flex h-[66px] items-center text-[16px]">No XP yet. Be first.</li>}
        {rows.map((r, i) => (
          <li key={r.fan_id} className={`flex h-[66px] items-center border-b border-hairline last:border-b-0 ${fanId === r.fan_id ? "text-yellow" : ""}`}>
            <span className="w-[39px] shrink-0 text-[24px] leading-none max-lg:w-[39px]">{r.rank}</span>
            <span className="fan-avatar mr-[22px] max-lg:mr-[14px]" aria-hidden="true"><i className="fa-solid fa-user-astronaut text-[20px]" /><i className="fa-solid fa-flag fan-flag" /></span>
            <span className="truncate text-[24px] leading-none max-lg:text-[16px]">{r.display_name}</span>
            <span className="ml-[20px] flex shrink-0 items-center gap-[9px] text-[16px]" aria-hidden="true">
              <i className="fa-solid fa-star" />
              {i < 3 && <i className="fa-solid fa-crown text-yellow" />}
            </span>
            <span className="ml-auto text-[24px] leading-none max-lg:text-[16px]">{fmtXp(r.xp)}</span>
          </li>
        ))}
      </ol>
      <div className="absolute bottom-[12px] left-[12px] right-[16px] flex items-center justify-between lg:justify-end">
        <Link href={`/${slug}/leaderboard?period=${period}`} className="text-[16px] leading-none hover:underline lg:hidden">View All</Link>
        {rankLine}
      </div>
    </section>
  );
}
