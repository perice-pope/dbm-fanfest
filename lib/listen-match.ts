/** Pure helpers for the listening quest: which ListenBrainz plays belong to the band. No network, no server imports. */

export type ListenConfig = { service?: "listenbrainz"; artist?: string; artist_mbid?: string; daily_cap?: number; services?: string[]; hint?: string };

export type LbListen = {
  listened_at: number;
  track_metadata: {
    artist_name?: string;
    track_name?: string;
    additional_info?: { music_service?: string; music_service_name?: string; origin_url?: string; spotify_id?: string };
    mbid_mapping?: { artist_mbids?: string[]; artists?: { artist_credit_name?: string }[]; recording_name?: string };
  };
};

export type Play = { track: string; listened_at: number };

export function normalizeName(s: string) {
  return s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
}

/** True when the credited artist is the band, alone or alongside others ("X feat. Destroyed by Moths"). Whole words only. */
export function isBandArtist(listen: LbListen, cfg: { artist: string; artist_mbid?: string }) {
  const m = listen.track_metadata;
  if (cfg.artist_mbid && m.mbid_mapping?.artist_mbids?.includes(cfg.artist_mbid)) return true;
  const want = ` ${normalizeName(cfg.artist)} `;
  const names = [m.artist_name ?? "", ...(m.mbid_mapping?.artists ?? []).map((a) => a.artist_credit_name ?? "")];
  return names.some((n) => n && ` ${normalizeName(n)} `.includes(want));
}

/** The streaming service a play reports, as a domain when ListenBrainz has one (spotify.com, youtube.com). Self-reported by the submitting app. */
export function serviceOf(listen: LbListen): string | null {
  const info = listen.track_metadata.additional_info ?? {};
  if (info.music_service) return info.music_service.toLowerCase();
  if (info.spotify_id || info.origin_url?.includes("open.spotify.com")) return "spotify.com";
  if (info.origin_url) {
    try { return new URL(info.origin_url).hostname.replace(/^www\./, "").replace(/^music\./, ""); } catch { /* not a URL */ }
  }
  return info.music_service_name ? info.music_service_name.toLowerCase() : null;
}

/** Band plays from a page of listens, oldest first, filtered by the optional service allowlist. */
export function bandPlays(listens: LbListen[], cfg: ListenConfig, fallbackArtist: string): Play[] {
  const artist = cfg.artist?.trim() || fallbackArtist;
  const allow = (cfg.services ?? []).map((s) => s.toLowerCase());
  return listens
    .filter((l) => Number.isFinite(l.listened_at) && isBandArtist(l, { artist, artist_mbid: cfg.artist_mbid }))
    .filter((l) => allow.length === 0 || allow.some((s) => serviceOf(l)?.endsWith(s)))
    .map((l) => ({ track: (l.track_metadata.mbid_mapping?.recording_name || l.track_metadata.track_name || "").trim(), listened_at: l.listened_at }))
    .filter((p) => p.track)
    .sort((a, b) => a.listened_at - b.listened_at);
}

/** Today's credited songs for the listening quest, from the fan's ledger (period keys look like 2026-10-27:her shoes). */
export function creditedToday(ledger: { quest_id: string | null; period_key: string; xp: number }[], questId: string, today: string) {
  return ledger.filter((l) => l.quest_id === questId && l.xp > 0 && l.period_key.startsWith(`${today}:`)).length;
}
