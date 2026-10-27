import { notFound } from "next/navigation";
import { getChannel, getChannelHome, getViewer } from "@/lib/data";
import { getChannelFigures } from "@/lib/channel-view";
import { questView, configOf } from "@/lib/quest-state";
import { periodKey } from "@/lib/period";
import { CheckIn } from "@/components/CheckIn";
import { Leaderboard } from "@/components/Leaderboard";
import { ActivityFeed } from "@/components/ActivityFeed";
import { NewsSection } from "@/components/NewsSection";
import { Rail } from "@/components/Rail";
import { QuestCard } from "@/components/QuestCard";
import { RewardCard } from "@/components/RewardCard";
import { requestOrigin } from "@/lib/site";

export const dynamic = "force-dynamic";

const QUEST_IMAGES = ["/dbm/quest-a.png", "/dbm/quest-b.png"];
const REWARD_IMAGES = ["/dbm/reward-a.png", "/dbm/reward-b.png"];

export default async function ChannelPage({ params }: { params: Promise<{ channel: string }> }) {
  const { channel: slug } = await params;
  const channel = await getChannel(slug);
  if (!channel) notFound();
  const { fan } = await getViewer();
  const [home, figures, origin] = await Promise.all([getChannelHome(channel, fan), getChannelFigures(channel, !!fan), requestOrigin()]);
  const now = new Date();
  const tz = channel.timezone;
  const views = home.quests.map((q) => questView(q, { tz, now, lifetimeXp: home.lifetimeXp, ledger: home.ledger, submissions: home.submissions }));
  const order = { available: 0, rejected: 1, in_review: 2, completed: 3, locked: 4, expired: 5 } as const;
  const sorted = [...views].sort((a, b) => order[a.state] - order[b.state] || a.quest.sort_order - b.quest.sort_order);
  const signedIn = !!fan;
  const statFor = (id: string) => home.rewardStats.find((s) => s.reward_id === id);
  const nowIso = now.toISOString();

  return (
    <>
      {signedIn && <CheckIn slug={slug} todayKey={periodKey("daily", tz, now)} />}
      <div className="mx-auto max-w-[1440px] px-[24px]">
        <div className="mt-[24px] grid gap-[25px] lg:mt-[51px] lg:grid-cols-[699fr_667fr]">
          <Leaderboard slug={slug} boards={home.boards} ranks={home.ranks} signedIn={signedIn} fanId={fan?.id ?? null} />
          <ActivityFeed feed={home.feed} monthXp={figures.monthXp} now={nowIso} />
        </div>
      </div>
      <div className="mt-[25px] lg:mt-[51px]">
        <NewsSection items={home.news} shareBase={`${origin}/${slug}`} />
      </div>
      <section id="quests" aria-label="Quests" className="scroll-mt-2 bg-section-quests">
        <div className="mx-auto max-w-[1440px] px-[24px] pt-[30px]">
          <h2 className="text-[32px] leading-none">Quests</h2>
          <div className="mt-[20px] lg:mt-[44px]">
            <Rail label="Quests">
              {sorted.map((v, i) => <QuestCard key={v.quest.id} view={v} slug={slug} tz={tz} signedIn={signedIn} now={nowIso} image={configOf(v.quest).image_url ?? QUEST_IMAGES[i % 2]} />)}
              {sorted.length === 0 && <p className="py-[40px] text-[16px]">No quests yet.</p>}
            </Rail>
          </div>
        </div>
      </section>
      <section id="rewards" aria-label="Rewards" className="scroll-mt-2 bg-section-dark">
        <div className="mx-auto max-w-[1440px] px-[24px] pt-[30px]">
          <h2 className="text-[32px] leading-none">Rewards</h2>
          <div className="mt-[21px] lg:mt-[44px]">
            <Rail label="Rewards">
              {home.rewards.map((r, i) => (
                <RewardCard key={r.id} reward={r} stat={statFor(r.id)} slug={slug} signedIn={signedIn} claimed={home.claims.includes(r.id)} entered={home.entries.includes(r.id)} lifetimeXp={home.lifetimeXp} image={REWARD_IMAGES[i % 2]} tz={tz} now={nowIso} />
              ))}
              {home.rewards.length === 0 && <p className="py-[40px] text-[16px]">Rewards are on the way.</p>}
            </Rail>
          </div>
        </div>
      </section>
    </>
  );
}
