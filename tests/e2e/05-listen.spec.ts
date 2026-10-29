import { test, expect } from "@playwright/test";
import { SLUG, ADMIN, FAN1, admin, signIn } from "./helpers";

// Drives the real ListenBrainz API against a public account, so the sync, matching and daily cap are tested end to end
// without a fan token. A temporary draft quest targets an artist that account actually played.
const LB_USER = process.env.E2E_LB_USER ?? "mr_monkey";
const SINCE_DAYS = 365;
let questId = "";
let adminId = "";
let artist = "";

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const since = Math.floor(Date.now() / 1000) - SINCE_DAYS * 86400;
  const res = await fetch(`https://api.listenbrainz.org/1/user/${LB_USER}/listens?count=100&min_ts=${since}`).catch(() => null);
  const listens = res?.ok ? ((await res.json()) as { payload: { listens: { track_metadata: { artist_name: string } }[] } }).payload.listens : [];
  const counts = new Map<string, number>();
  for (const l of listens) counts.set(l.track_metadata.artist_name, (counts.get(l.track_metadata.artist_name) ?? 0) + 1);
  artist = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  if (!artist) return;
  const sb = admin();
  const { data: ch } = await sb.from("channels").select("id").eq("slug", SLUG).single();
  const { data: fan } = await sb.from("fans").select("id").eq("email", ADMIN).single();
  adminId = fan!.id;
  const { data: q } = await sb.from("quests").insert({
    channel_id: ch!.id, type: "listen", title: "E2E listening quest", xp: 10, repeat_rule: "daily", status: "draft", sort_order: 999,
    config: { service: "listenbrainz", artist, daily_cap: 2, any_play_xp: 2, any_play_cap: 3 },
  }).select("id").single();
  questId = q!.id;
  await sb.from("listen_accounts").delete().eq("fan_id", adminId);
  await sb.from("listen_accounts").insert({ fan_id: adminId, username: LB_USER, connected_at: new Date(since * 1000).toISOString() });
});

test.afterAll(async () => {
  const sb = admin();
  if (adminId) await sb.from("listen_accounts").delete().eq("fan_id", adminId);
  if (questId) {
    await sb.from("xp_ledger").delete().eq("quest_id", questId);
    await sb.from("quests").delete().eq("id", questId);
  }
});

test("fans cannot open a draft listening quest", async ({ page }) => {
  test.skip(!questId, "ListenBrainz unreachable or the public account has no recent listens");
  await signIn(page, FAN1, `/${SLUG}/q/${questId}`);
  await expect(page.getByText("Draft preview")).toHaveCount(0);
  await expect(page.getByText(/could not be found|404/i).first()).toBeVisible();
});

test("an admin previews the draft, plays are paid on load up to the daily cap", async ({ page }) => {
  test.skip(!questId, "ListenBrainz unreachable or the public account has no recent listens");
  await signIn(page, ADMIN, `/${SLUG}/q/${questId}`);
  await expect(page.getByText("Draft preview")).toBeVisible();
  await expect(page.getByText(`connected as ${LB_USER}`)).toBeVisible();
  // The page checks plays on load, like the EJAE Spotify scan; wait for that payout to land.
  await expect.poll(async () => (await admin().from("xp_ledger").select("id", { count: "exact", head: true }).eq("quest_id", questId)).count ?? 0, { timeout: 45_000 }).toBeGreaterThan(0);
  const { data: rows } = await admin().from("xp_ledger").select("period_key, xp, note, source").eq("quest_id", questId);
  const band = rows!.filter((r) => r.source === "listen");
  expect(band.length).toBeGreaterThan(0);
  // Never more than daily_cap (2) songs on any one day, and never the same song twice in a day.
  const perDay = new Map<string, number>();
  for (const r of band) perDay.set(r.period_key.slice(0, 10), (perDay.get(r.period_key.slice(0, 10)) ?? 0) + 1);
  expect(Math.max(...perDay.values())).toBeLessThanOrEqual(2);
  expect(new Set(band.map((r) => r.period_key)).size).toBe(band.length);
  expect(band.every((r) => r.xp === 10 && r.note?.startsWith("Streamed "))).toBe(true);
  // Other plays pay the small amount once each, never more than any_play_cap (3) a day.
  const other = rows!.filter((r) => r.source === "listen_any");
  expect(other.every((r) => r.xp === 2 && r.note === "Streamed music")).toBe(true);
  const otherPerDay = new Map<string, number>();
  for (const r of other) otherPerDay.set(r.period_key.slice(0, 10), (otherPerDay.get(r.period_key.slice(0, 10)) ?? 0) + 1);
  if (other.length) expect(Math.max(...otherPerDay.values())).toBeLessThanOrEqual(3);
  // A manual check inside a minute of the automatic one is refused instead of hammering the service.
  await page.getByRole("button", { name: "Check my plays" }).click();
  await expect(page.getByText("Just checked. Try again in a minute.")).toBeVisible();
});

test("a bad token is refused and nothing is linked", async ({ page }) => {
  test.skip(!questId, "ListenBrainz unreachable or the public account has no recent listens");
  await admin().from("listen_accounts").delete().eq("fan_id", adminId);
  await signIn(page, ADMIN, `/${SLUG}/q/${questId}`);
  // With Spotify or Last.fm keys the ListenBrainz form is folded away behind a toggle.
  const toggle = page.getByRole("button", { name: "Use ListenBrainz instead" });
  if (await toggle.count()) await toggle.click();
  await page.getByLabel("ListenBrainz user token").fill("00000000-0000-0000-0000-000000000000");
  await page.getByRole("button", { name: "Connect ListenBrainz" }).click();
  await expect(page.getByText("ListenBrainz did not accept that token.", { exact: false })).toBeVisible({ timeout: 15_000 });
  const { count } = await admin().from("listen_accounts").select("fan_id", { count: "exact", head: true }).eq("fan_id", adminId);
  expect(count).toBe(0);
});

test("the Spotify link is offered only when the site has Spotify keys", async ({ page }) => {
  test.skip(!questId, "ListenBrainz unreachable or the public account has no recent listens");
  await admin().from("listen_accounts").delete().eq("fan_id", adminId);
  await signIn(page, ADMIN, `/${SLUG}/q/${questId}`);
  const configured = !!(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
  const link = page.getByRole("link", { name: "Connect Spotify" });
  if (!configured) { await expect(link).toHaveCount(0); return; }
  await expect(link).toBeVisible();
  // The connect route hands the fan to Spotify's approval page with our callback and the read-only scope.
  const res = await page.request.get(`/api/spotify/connect?slug=${SLUG}&quest=${questId}`, { maxRedirects: 0 });
  expect(res.status()).toBe(307);
  const to = new URL(res.headers()["location"]);
  expect(to.hostname).toBe("accounts.spotify.com");
  expect(to.searchParams.get("redirect_uri")).toContain("/api/spotify/callback");
  expect(to.searchParams.get("scope")).toBe("user-read-recently-played");
  // A callback without the state cookie is refused and links nothing.
  const cb = await page.request.get(`/api/spotify/callback?code=x&state=y`, { maxRedirects: 0 });
  expect([302, 307]).toContain(cb.status());
  const { count } = await admin().from("listen_accounts").select("fan_id", { count: "exact", head: true }).eq("fan_id", adminId);
  expect(count).toBe(0);
});

test("the Last.fm link is offered only when the site has Last.fm keys", async ({ page }) => {
  test.skip(!questId, "ListenBrainz unreachable or the public account has no recent listens");
  await admin().from("listen_accounts").delete().eq("fan_id", adminId);
  await signIn(page, ADMIN, `/${SLUG}/q/${questId}`);
  const configured = !!(process.env.LASTFM_API_KEY && process.env.LASTFM_SHARED_SECRET);
  const link = page.getByRole("link", { name: "Connect Last.fm" });
  if (!configured) {
    await expect(link).toHaveCount(0);
    await expect(page.getByLabel("ListenBrainz user token")).toBeVisible();
    return;
  }
  await expect(link).toBeVisible();
  // The connect route must hand the fan to Last.fm's approval page with our callback attached.
  const res = await page.request.get(`/api/lastfm/connect?slug=${SLUG}&quest=${questId}`, { maxRedirects: 0 });
  expect(res.status()).toBe(307);
  const to = new URL(res.headers()["location"]);
  expect(to.hostname).toBe("www.last.fm");
  expect(to.searchParams.get("cb")).toContain("/api/lastfm/callback?state=");
});
