// Server only. One sync for both listening services; pays through award_listens and moves the fan's cursor.
import { createAdminClient } from "@/lib/supabase/server";
import { bandPlays, isBandArtist, type ListenConfig } from "@/lib/listen-match";
import { listensAfter } from "@/lib/listenbrainz";
import { recentTracks } from "@/lib/lastfm";

export type SyncResult = { awarded: number; any: number; xp: number; capped: number; checked: number };

export async function syncFan(fanId: string, questId: string, opts: { allowDraft?: boolean } = {}): Promise<SyncResult> {
  const sb = createAdminClient();
  const [{ data: acc }, { data: quest }] = await Promise.all([
    sb.from("listen_accounts").select("*").eq("fan_id", fanId).maybeSingle(),
    sb.from("quests").select("id, config, channel_id, channels(name)").eq("id", questId).single(),
  ]);
  if (!acc) throw new Error("NOT_CONNECTED");
  if (!quest) throw new Error("QUEST_UNAVAILABLE");
  const cfg = (quest.config ?? {}) as ListenConfig;
  const artist = cfg.artist?.trim() || (quest.channels as { name: string } | null)?.name || "";
  const since = Math.max(acc.cursor_ts, Math.floor(new Date(acc.connected_at).getTime() / 1000));
  let plays: { track: string; listened_at: number; band: boolean }[] = [];
  let cursor = since;
  let checked = 0;
  if (acc.service === "lastfm") {
    const r = await recentTracks(acc.username, since, acc.session_key);
    checked = r.plays.length;
    cursor = r.cursor;
    plays = r.plays.map((p) => ({
      track: p.track, listened_at: p.listened_at,
      band: isBandArtist({ listened_at: p.listened_at, track_metadata: { artist_name: p.artist, track_name: p.track, mbid_mapping: p.artistMbid ? { artist_mbids: [p.artistMbid] } : undefined } }, { artist, artist_mbid: cfg.artist_mbid }),
    }));
  } else {
    const r = await listensAfter(acc.username, since);
    checked = r.listens.length;
    cursor = r.cursor;
    const band = new Set(bandPlays(r.listens, cfg, artist).map((p) => `${p.listened_at}:${p.track}`));
    plays = r.listens
      .filter((l) => Number.isFinite(l.listened_at))
      .map((l) => {
        const track = (l.track_metadata.mbid_mapping?.recording_name || l.track_metadata.track_name || "").trim();
        return { track, listened_at: l.listened_at, band: band.has(`${l.listened_at}:${track}`) };
      })
      .filter((p) => p.track);
  }
  let result = { awarded: 0, any: 0, xp: 0, capped: 0 };
  if (plays.length) {
    const { data, error } = await sb.rpc("award_listens", { p_quest: questId, p_fan: fanId, p_plays: plays, p_allow_draft: !!opts.allowDraft });
    if (error) throw error;
    result = { ...result, ...(data as Partial<typeof result>) };
  }
  await sb.from("listen_accounts").update({ cursor_ts: cursor, last_synced_at: new Date().toISOString() }).eq("fan_id", fanId);
  return { ...result, checked };
}
