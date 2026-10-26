import { notFound } from "next/navigation";
import { getChannel, getChannelHome, getViewer } from "@/lib/data";
import { questView } from "@/lib/quest-state";
import { periodKey } from "@/lib/period";
import { CheckIn } from "@/components/CheckIn";
import { Leaderboard } from "@/components/Leaderboard";
import { ActivityFeed } from "@/components/ActivityFeed";
import { NewsCarousel } from "@/components/NewsCarousel";
import { SectionTabs } from "@/components/SectionTabs";
import { QuestCard } from "@/components/QuestCard";
import { RewardCard } from "@/components/RewardCard";

export const dynamic = "force-dynamic";

export default async function ChannelPage({ params }: { params: Promise<{ channel: string }> }) {
  const { channel: slug } = await params;
  const channel = await getChannel(slug);
  if (!channel) notFound();
  const { fan } = await getViewer();
  const home = await getChannelHome(channel, fan);
  const now = new Date();
  const tz = channel.timezone;
  const views = home.quests.map((q) => questView(q, { tz, now, lifetimeXp: home.lifetimeXp, ledger: home.ledger, submissions: home.submissions }));
  const order = { available: 0, rejected: 1, in_review: 2, completed: 3, locked: 4, expired: 5 } as const;
  const sorted = [...views].sort((a, b) => order[a.state] - order[b.state] || a.quest.sort_order - b.quest.sort_order);
  const todayIndex = ((Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).formatToParts(now).find((p) => p.type === "weekday")?.value ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(now)) : 0)) + 7) % 7;
  const signedIn = !!fan;
  const counts = { news: home.news.length, quests: views.filter((v) => v.state !== "expired").length, rewards: home.stats.rewards };
  const statFor = (id: string) => home.rewardStats.find((s) => s.reward_id === id);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-8">
      {signedIn && fan?.display_name && <CheckIn slug={slug} todayKey={periodKey("daily", tz, now)} />}
      <div className="min-w-0 space-y-5">
        <Leaderboard slug={slug} boards={home.boards} ranks={home.ranks} signedIn={signedIn} displayName={fan?.display_name ?? null} />
        <ActivityFeed feed={home.feed} stats={home.stats} todayIndex={todayIndex} />
      </div>
      <div className="min-w-0 space-y-5">
        <SectionTabs counts={counts} />
        <NewsCarousel items={home.news} />
        <section id="quests" className="scroll-mt-16 space-y-4" aria-label="Quests">
          <h2 className="display text-3xl">Quests <span className="text-muted">{counts.quests}</span></h2>
          {sorted.map((v) => <QuestCard key={v.quest.id} view={v} slug={slug} tz={tz} signedIn={signedIn} />)}
          {sorted.length === 0 && <p className="card p-5 text-sm text-muted">No quests yet. Check back soon.</p>}
        </section>
        <section id="rewards" className="scroll-mt-16 space-y-4" aria-label="Rewards">
          <h2 className="display text-3xl">Rewards <span className="text-muted">{counts.rewards}</span></h2>
          {home.rewards.map((r) => (
            <RewardCard key={r.id} reward={r} stat={statFor(r.id)} slug={slug} signedIn={signedIn} claimed={home.claims.includes(r.id)} entered={home.entries.includes(r.id)} lifetimeXp={home.lifetimeXp} />
          ))}
          {home.rewards.length === 0 && <p className="card p-5 text-sm text-muted">Rewards are on the way.</p>}
        </section>
      </div>
    </div>
  );
}
