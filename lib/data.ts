import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export type Channel = Database["public"]["Tables"]["channels"]["Row"];
export type Quest = Database["public"]["Tables"]["quests"]["Row"];
export type Reward = Database["public"]["Tables"]["rewards"]["Row"];
export type NewsItem = Database["public"]["Tables"]["news_items"]["Row"];
export type Fan = Database["public"]["Tables"]["fans"]["Row"];
export type Submission = Database["public"]["Tables"]["submissions"]["Row"];
export type LedgerRow = Pick<Database["public"]["Tables"]["xp_ledger"]["Row"], "id" | "quest_id" | "period_key" | "xp" | "note" | "source" | "created_at">;
export type BoardRow = { rank: number; fan_id: string; display_name: string; xp: number };
export type MyRank = { hidden: boolean; rank: number | null; xp: number } | null;
export type FeedRow = { id: string; display_name: string; note: string | null; xp: number; source: string; created_at: string };
export type Stats = { week_xp: number; days: number[]; fans: number; quests: number; news: number; rewards: number; week_start: string };
export type RewardStat = { reward_id: string; claims: number; entries: number; winner_name: string | null };
export type Period = "weekly" | "monthly" | "lifetime";
export const PERIODS: Period[] = ["weekly", "monthly", "lifetime"];

export type ChannelTheme = { accent?: string; bg?: string; surface?: string; text?: string };
export type ChannelSettings = {
  merch_store_name?: string;
  review_cadence?: string;
  submissions_per_day?: number;
  max_pending?: number;
  theme?: ChannelTheme;
  show_header_counters?: boolean;
  chat_url?: string;
};

export function settingsOf(ch: Channel): ChannelSettings {
  return (ch.settings ?? {}) as ChannelSettings;
}

export async function getChannel(slug: string) {
  const sb = await createClient();
  const { data } = await sb.from("channels").select("*").eq("slug", slug).maybeSingle();
  return data;
}

export async function getViewer() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { user: null, fan: null as Fan | null };
  const { data: fan } = await sb.from("fans").select("*").eq("id", user.id).maybeSingle();
  return { user, fan };
}

export async function isAdminOf(channelId: string) {
  const sb = await createClient();
  const { data } = await sb.rpc("is_admin", { p_channel: channelId });
  return data === true;
}

export async function getFanContext(channel: Channel, fan: Fan | null) {
  if (!fan) return { ledger: [] as LedgerRow[], submissions: [] as Submission[], claims: [] as string[], entries: [] as string[], joinedList: false, lifetimeXp: 0 };
  const sb = await createClient();
  const [ledger, submissions, claims, entries, signup, total] = await Promise.all([
    sb.from("xp_ledger").select("id, quest_id, period_key, xp, note, source, created_at").eq("channel_id", channel.id).eq("fan_id", fan.id).order("created_at", { ascending: false }).limit(500),
    sb.from("submissions").select("*").eq("channel_id", channel.id).eq("fan_id", fan.id).order("created_at", { ascending: false }).limit(200),
    sb.from("reward_claims").select("reward_id").eq("fan_id", fan.id),
    sb.from("reward_entries").select("reward_id").eq("fan_id", fan.id),
    sb.from("email_signups").select("id").eq("channel_id", channel.id).eq("fan_id", fan.id).maybeSingle(),
    sb.rpc("fan_total_xp", { p_channel: channel.id, p_fan: fan.id }),
  ]);
  return {
    ledger: (ledger.data ?? []) as LedgerRow[],
    submissions: (submissions.data ?? []) as Submission[],
    claims: (claims.data ?? []).map((c) => c.reward_id),
    entries: (entries.data ?? []).map((e) => e.reward_id),
    joinedList: !!signup.data,
    lifetimeXp: (total.data as number | null) ?? 0,
  };
}

export async function getChannelHome(channel: Channel, fan: Fan | null) {
  const sb = await createClient();
  const boardCalls = PERIODS.map((p) => sb.rpc("leaderboard", { p_channel: channel.id, p_period: p, p_limit: 3, p_offset: 0 }));
  const rankCalls = fan ? PERIODS.map((p) => sb.rpc("my_rank", { p_channel: channel.id, p_period: p })) : [];
  const [quests, news, rewards, rewardStats, feed, stats, boards, ranks, fanCtx] = await Promise.all([
    sb.from("quests").select("*").eq("channel_id", channel.id).eq("status", "live").order("sort_order", { ascending: true }),
    sb.from("news_items").select("*").eq("channel_id", channel.id).eq("is_active", true).order("sort_order", { ascending: true }).order("published_at", { ascending: false }),
    sb.from("rewards").select("*").eq("channel_id", channel.id).in("status", ["live", "closed"]).order("sort_order", { ascending: true }),
    sb.rpc("reward_stats", { p_channel: channel.id }),
    sb.rpc("activity_feed", { p_channel: channel.id, p_limit: 20 }),
    sb.rpc("channel_stats", { p_channel: channel.id }),
    Promise.all(boardCalls),
    Promise.all(rankCalls),
    getFanContext(channel, fan),
  ]);
  const boardMap = Object.fromEntries(PERIODS.map((p, i) => [p, (boards[i].data ?? []) as BoardRow[]])) as Record<Period, BoardRow[]>;
  const rankMap = Object.fromEntries(PERIODS.map((p, i) => [p, (ranks[i]?.data ?? null) as MyRank])) as Record<Period, MyRank>;
  return {
    quests: (quests.data ?? []) as Quest[],
    news: (news.data ?? []) as NewsItem[],
    rewards: (rewards.data ?? []) as Reward[],
    rewardStats: (rewardStats.data ?? []) as RewardStat[],
    feed: (feed.data ?? []) as FeedRow[],
    stats: (stats.data ?? { week_xp: 0, days: [0, 0, 0, 0, 0, 0, 0], fans: 0, quests: 0, news: 0, rewards: 0, week_start: "" }) as Stats,
    boards: boardMap,
    ranks: rankMap,
    ...fanCtx,
  };
}
