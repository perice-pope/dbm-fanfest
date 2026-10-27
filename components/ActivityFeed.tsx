import { fmtPlusXp } from "@/lib/figma-format";
import { compact } from "@/lib/channel-view";
import { timeAgo } from "@/lib/format";
import type { FeedRow } from "@/lib/data";

export function ActivityFeed({ feed, monthXp, now }: { feed: FeedRow[]; monthXp: number; now: string }) {
  const n = new Date(now);
  return (
    <section id="activity" aria-label="Recent activity" className="fig-card h-[371px] overflow-hidden px-[16px] pt-[20px]">
      <h2 className="text-[24px] leading-none lg:text-[32px]">Recent Activity</h2>
      <p className="mt-[22px] flex items-baseline gap-[12px] pl-[3px]">
        <span className="text-[24px] leading-none">{compact(monthXp)} xp</span>
        <span className="text-[16px] leading-none">earned by fans this month</span>
      </p>
      <ul className="mt-[14px] max-h-[220px] overflow-y-auto [scrollbar-width:none]">
        {feed.length === 0 && <li className="py-[20px] text-[16px]">No activity yet. Complete a quest to start the feed.</li>}
        {feed.map((f) => (
          <li key={f.id} className="flex h-[73px] items-center border-b border-hairline last:border-b-0">
            <span className="fan-avatar ml-[9px] mr-[26px]" aria-hidden="true"><i className="fa-solid fa-user-astronaut text-[20px]" /><i className="fa-solid fa-flag fan-flag" /></span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[16px] leading-none">{f.display_name}</span>
              <span className="mt-[6px] block truncate text-[16px] leading-none">{(f.note ?? f.source.replace(/_/g, " ")).replace(/^Daily visit reward$/i, "checked in")} {timeAgo(f.created_at, n)}</span>
            </span>
            <span className="ml-[12px] shrink-0 text-[24px] leading-none max-lg:text-[16px]">{fmtPlusXp(f.xp)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
