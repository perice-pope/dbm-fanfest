import type { createClient } from "@/lib/supabase/server";
import type { Channel, BoardRow } from "@/lib/data";

/** The server client, passed in so this module stays importable from client components (compact). */
type Db = Awaited<ReturnType<typeof createClient>>;

/** Header and card figures the Figma shows: fans, lifetime XP, month XP, fans online. */
export async function getChannelFigures(channel: Channel, sb: Db) {
  const [month, life, online] = await Promise.all([
    sb.rpc("leaderboard", { p_channel: channel.id, p_period: "monthly", p_limit: 5000, p_offset: 0 }),
    sb.rpc("leaderboard", { p_channel: channel.id, p_period: "lifetime", p_limit: 5000, p_offset: 0 }),
    sb.rpc("fans_online", { p_channel: channel.id }),
  ]);
  const monthRows = (month.data ?? []) as BoardRow[];
  const lifeRows = (life.data ?? []) as BoardRow[];
  const monthXp = monthRows.reduce((s, r) => s + Number(r.xp), 0);
  const lifetimeXp = lifeRows.reduce((s, r) => s + Number(r.xp), 0);
  return { monthXp, lifetimeXp, fans: lifeRows.length, online: Number(online.data ?? 0) };
}

export function compact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}m`;
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1).replace(/\.0$/, "")}k`;
  return String(n);
}

export type ChannelLinks = { shows?: string | null; news?: string | null; merch?: string | null; community?: string | null; facebook?: string | null; x?: string | null; instagram?: string | null; youtube?: string | null; tiktok?: string | null; twitch?: string | null; spotify?: string | null };
export function linksOf(ch: Channel): ChannelLinks {
  return (ch.links ?? {}) as ChannelLinks;
}
