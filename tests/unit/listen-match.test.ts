import { describe, it, expect } from "vitest";
import { bandPlays, creditedToday, isBandArtist, serviceOf, type LbListen } from "@/lib/listen-match";

const play = (artist: string, track: string, at: number, info: LbListen["track_metadata"]["additional_info"] = {}, mapping?: LbListen["track_metadata"]["mbid_mapping"]): LbListen =>
  ({ listened_at: at, track_metadata: { artist_name: artist, track_name: track, additional_info: info, mbid_mapping: mapping } });

describe("isBandArtist", () => {
  const cfg = { artist: "Destroyed by Moths" };
  it("matches the band alone or credited with others, ignoring case and punctuation", () => {
    expect(isBandArtist(play("Destroyed by Moths", "Her Shoes", 1), cfg)).toBe(true);
    expect(isBandArtist(play("DESTROYED BY MOTHS", "x", 1), cfg)).toBe(true);
    expect(isBandArtist(play("Someone feat. Destroyed by Moths", "x", 1), cfg)).toBe(true);
    expect(isBandArtist(play("Destroyed-by-Moths", "x", 1), cfg)).toBe(true);
  });
  it("does not match other artists that only share words", () => {
    expect(isBandArtist(play("Moths", "x", 1), cfg)).toBe(false);
    expect(isBandArtist(play("Destroyed by Mothsy", "x", 1), cfg)).toBe(false);
    expect(isBandArtist(play("Undestroyed by Moths", "x", 1), cfg)).toBe(false);
  });
  it("matches by MusicBrainz artist id when one is configured", () => {
    const l = play("DBM", "x", 1, {}, { artist_mbids: ["abc"] });
    expect(isBandArtist(l, { artist: "Destroyed by Moths", artist_mbid: "abc" })).toBe(true);
  });
});

describe("serviceOf", () => {
  it("reads the reported service, falling back to Spotify ids and origin URLs", () => {
    expect(serviceOf(play("a", "b", 1, { music_service: "Spotify.com" }))).toBe("spotify.com");
    expect(serviceOf(play("a", "b", 1, { spotify_id: "https://open.spotify.com/track/1" }))).toBe("spotify.com");
    expect(serviceOf(play("a", "b", 1, { origin_url: "https://music.youtube.com/watch?v=1" }))).toBe("youtube.com");
    expect(serviceOf(play("a", "b", 1, {}))).toBeNull();
  });
});

describe("bandPlays", () => {
  const listens = [
    play("Destroyed by Moths", "Her Shoes", 300, { music_service: "spotify.com" }),
    play("Other Band", "Song", 200),
    play("Destroyed by Moths", "Second Song", 100, { music_service: "youtube.com" }),
    play("Destroyed by Moths", "  ", 50),
  ];
  it("keeps the band's named plays, oldest first", () => {
    expect(bandPlays(listens, {}, "Destroyed by Moths")).toEqual([{ track: "Second Song", listened_at: 100 }, { track: "Her Shoes", listened_at: 300 }]);
  });
  it("applies the service allowlist when one is set", () => {
    expect(bandPlays(listens, { services: ["spotify.com"] }, "Destroyed by Moths")).toEqual([{ track: "Her Shoes", listened_at: 300 }]);
  });
  it("prefers the configured artist over the channel name", () => {
    expect(bandPlays([play("DBM Live", "x", 1)], { artist: "DBM Live" }, "Destroyed by Moths")).toHaveLength(1);
  });
});

describe("creditedToday", () => {
  it("counts today's paid songs for the quest only", () => {
    const ledger = [
      { quest_id: "q", period_key: "2026-10-27:her shoes", xp: 25 },
      { quest_id: "q", period_key: "2026-10-27:song b", xp: 25 },
      { quest_id: "q", period_key: "2026-10-26:song b", xp: 25 },
      { quest_id: "other", period_key: "2026-10-27:x", xp: 25 },
      { quest_id: "q", period_key: "2026-10-27:reversed", xp: -25 },
    ];
    expect(creditedToday(ledger, "q", "2026-10-27")).toBe(2);
  });
});

describe("creditedToday ignores small any-play rows", () => {
  it("counts band songs only", () => {
    expect(creditedToday([
      { quest_id: "q", period_key: "2026-10-27:her shoes", xp: 25 },
      { quest_id: "q", period_key: "2026-10-27:any:1761000000", xp: 5 },
    ], "q", "2026-10-27")).toBe(1);
  });
});
