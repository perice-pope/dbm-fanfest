"use client";
import { useEffect, useState } from "react";
import { fmtPlusXp } from "@/lib/figma-format";
import { compact } from "@/lib/channel-view";
import { timeAgo } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { FeedRow } from "@/lib/data";

const ROW = 73;
const SPEED = 18; // px per second
const MIN_MARQUEE = 4; // three rows fit the 220px viewport, so fewer never scroll

export function ActivityFeed({ channelId, feed, monthXp, now }: { channelId: string; feed: FeedRow[]; monthXp: number; now: string }) {
  const [rows, setRows] = useState(feed);
  const [nowIso, setNowIso] = useState(now);
  const [paused, setPaused] = useState(false);
  const n = new Date(nowIso);
  const marquee = rows.length >= MIN_MARQUEE;

  useEffect(() => {
    const t = setInterval(() => setNowIso(new Date().toISOString()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const sb = createClient();
    const t = setInterval(async () => {
      const { data } = await sb.rpc("activity_feed", { p_channel: channelId, p_limit: 20 });
      if (data) setRows(data);
    }, 30_000);
    return () => clearInterval(t);
  }, [channelId]);

  const items = (last: boolean) => rows.map((f) => (
    <li key={f.id} className={`flex h-[73px] items-center border-b border-hairline ${last ? "last:border-b-0" : ""}`}>
      <span className="fan-avatar ml-[9px] mr-[26px]" aria-hidden="true"><i className="fa-solid fa-user-astronaut text-[20px]" /><i className="fa-solid fa-flag fan-flag" /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] leading-none">{f.display_name}</span>
        <span className="mt-[6px] block truncate text-[16px] leading-none">{(f.note ?? f.source.replace(/_/g, " ")).replace(/^Daily visit reward$/i, "checked in")} {timeAgo(f.created_at, n)}</span>
      </span>
      <span className="ml-[12px] shrink-0 text-[24px] leading-none max-lg:text-[16px]">{fmtPlusXp(f.xp)}</span>
    </li>
  ));

  return (
    <section id="activity" aria-label="Recent activity" className="fig-card h-[371px] overflow-hidden px-[16px] pt-[20px]">
      <h2 className="text-[24px] leading-none lg:text-[32px]">Recent Activity</h2>
      <p className="mt-[22px] flex items-baseline gap-[12px] pl-[3px]">
        <span className="text-[24px] leading-none">{compact(monthXp)} xp</span>
        <span className="text-[16px] leading-none">earned by fans this month</span>
      </p>
      {marquee ? (
        <div
          className="feed-marquee mt-[14px] max-h-[220px]"
          data-paused={paused || undefined}
          onTouchStart={() => setPaused(true)}
          onTouchEnd={() => setPaused(false)}
          onTouchCancel={() => setPaused(false)}
        >
          <div className="feed-marquee-track" style={{ "--feed-shift": `${rows.length * ROW}px`, "--feed-duration": `${(rows.length * ROW) / SPEED}s` } as React.CSSProperties}>
            <ul>{items(false)}</ul>
            <ul className="feed-marquee-copy" aria-hidden="true">{items(false)}</ul>
          </div>
        </div>
      ) : (
        <ul className="mt-[14px] max-h-[220px] overflow-y-auto [scrollbar-width:none]">
          {rows.length === 0 && <li className="py-[20px] text-[16px]">No activity yet. Complete a quest to start the feed.</li>}
          {items(true)}
        </ul>
      )}
    </section>
  );
}
