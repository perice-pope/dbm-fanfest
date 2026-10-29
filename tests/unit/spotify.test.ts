import { afterEach, describe, expect, it, vi } from "vitest";
import { recentlyPlayed, spotifyAuthUrl } from "@/lib/spotify";

const item = (name: string, artists: string[], playedAt: string) => ({ track: { name, artists: artists.map((n) => ({ name: n })) }, played_at: playedAt });

afterEach(() => vi.unstubAllGlobals());

describe("spotify", () => {
  it("builds the approval URL with the read-only scope and the exact redirect", () => {
    vi.stubEnv("SPOTIFY_CLIENT_ID", "abc");
    const u = new URL(spotifyAuthUrl("st", "https://x.test/api/spotify/callback"));
    expect(u.hostname).toBe("accounts.spotify.com");
    expect(u.searchParams.get("scope")).toBe("user-read-recently-played");
    expect(u.searchParams.get("redirect_uri")).toBe("https://x.test/api/spotify/callback");
    expect(u.searchParams.get("state")).toBe("st");
  });

  it("maps recent plays oldest first, drops plays at or before the cursor, and moves the cursor", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      expect(url).toContain("after=1000000");
      return new Response(JSON.stringify({ items: [
        item("New Song", ["Destroyed by Moths"], "1970-01-01T00:16:50.500Z"),
        item("Other", ["Someone", "Destroyed by Moths"], "1970-01-01T00:16:45.000Z"),
        item("Old", ["X"], "1970-01-01T00:16:40.000Z"),
        item("", ["X"], "1970-01-01T00:16:48.000Z"),
      ] }), { status: 200 });
    }));
    const r = await recentlyPlayed("tok", 1000);
    expect(r.plays.map((p) => p.track)).toEqual(["Other", "New Song"]);
    expect(r.plays[0].artists).toEqual(["Someone", "Destroyed by Moths"]);
    expect(r.cursor).toBe(1010);
  });

  it("turns Spotify's status codes into site error codes", async () => {
    for (const [status, code] of [[401, "SP_BAD_TOKEN"], [403, "SP_NOT_ALLOWED"], [429, "SP_DOWN"]] as const) {
      vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status })));
      await expect(recentlyPlayed("tok", 0)).rejects.toThrow(code);
    }
  });
});
