import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getChannel, getViewer, type BoardRow, type MyRank, type Period, PERIODS } from "@/lib/data";
import { fmtXp } from "@/lib/format";

export const dynamic = "force-dynamic";
const PAGE = 50;

export default async function LeaderboardPage({ params, searchParams }: { params: Promise<{ channel: string }>; searchParams: Promise<{ period?: string; page?: string }> }) {
  const { channel: slug } = await params;
  const sp = await searchParams;
  const period = (PERIODS.includes(sp.period as Period) ? sp.period : "weekly") as Period;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const channel = await getChannel(slug);
  if (!channel) notFound();
  const { fan } = await getViewer();
  const sb = await createClient();
  const [{ data: rows }, { data: mine }] = await Promise.all([
    sb.rpc("leaderboard", { p_channel: channel.id, p_period: period, p_limit: PAGE, p_offset: (page - 1) * PAGE }),
    fan ? sb.rpc("my_rank", { p_channel: channel.id, p_period: period }) : Promise.resolve({ data: null }),
  ]);
  const list = (rows ?? []) as BoardRow[];
  const me = mine as MyRank;
  return (
    <div className="mx-auto max-w-2xl px-[24px] pt-[24px]">
      <div className="flex items-center justify-between gap-3">
        <h2 className="display text-4xl">Leaderboard</h2>
        <Link href={`/${slug}`} className="text-xs uppercase tracking-[0.12em] text-muted hover:text-text">Back</Link>
      </div>
      <div className="seg mt-4">
        {PERIODS.map((p) => (
          <Link key={p} href={`/${slug}/leaderboard?period=${p}`} aria-current={p === period ? "page" : undefined}>
            <button type="button" aria-pressed={p === period}>{p}</button>
          </Link>
        ))}
      </div>
      {me && !me.hidden && me.rank != null && <p className="mt-4 text-sm text-muted">You are #{me.rank} with {fmtXp(me.xp)} XP.</p>}
      {me?.hidden && <p className="mt-4 text-sm text-muted">You are hidden from the leaderboard.</p>}
      <ol className="card mt-4 divide-y divide-line px-4">
        {list.length === 0 && <li className="py-8 text-center text-sm text-muted">Nobody here yet.</li>}
        {list.map((r) => (
          <li key={r.fan_id} className={`flex items-center gap-3 py-3 ${fan && r.fan_id === fan.id ? "text-accent" : ""}`}>
            <span className="display w-10 text-2xl text-accent">{r.rank}</span>
            <span className="flex-1 truncate font-medium">{r.display_name}</span>
            <span className="display text-xl">{fmtXp(r.xp)}</span>
          </li>
        ))}
      </ol>
      <div className="mt-4 flex justify-between text-sm">
        {page > 1 ? <Link className="btn btn-secondary" href={`/${slug}/leaderboard?period=${period}&page=${page - 1}`}>Previous</Link> : <span />}
        {list.length === PAGE ? <Link className="btn btn-secondary" href={`/${slug}/leaderboard?period=${period}&page=${page + 1}`}>Next</Link> : <span />}
      </div>
    </div>
  );
}
