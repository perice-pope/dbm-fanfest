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
    config: { service: "listenbrainz", artist, daily_cap: 2 },
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

test("an admin previews the draft, checks plays and is paid up to the daily cap", async ({ page }) => {
  test.skip(!questId, "ListenBrainz unreachable or the public account has no recent listens");
  await signIn(page, ADMIN, `/${SLUG}/q/${questId}`);
  await expect(page.getByText("Draft preview")).toBeVisible();
  await expect(page.getByText(`Connected as ${LB_USER}`)).toBeVisible();
  await page.getByRole("button", { name: "Check my plays" }).click();
  await expect(page.getByText(/\+\d+ XP · \d song/).first()).toBeVisible({ timeout: 30_000 });
  const { data: rows } = await admin().from("xp_ledger").select("period_key, xp, note").eq("quest_id", questId);
  expect(rows!.length).toBeGreaterThan(0);
  // Never more than daily_cap (2) songs on any one day, and never the same song twice in a day.
  const perDay = new Map<string, number>();
  for (const r of rows!) perDay.set(r.period_key.slice(0, 10), (perDay.get(r.period_key.slice(0, 10)) ?? 0) + 1);
  expect(Math.max(...perDay.values())).toBeLessThanOrEqual(2);
  expect(new Set(rows!.map((r) => r.period_key)).size).toBe(rows!.length);
  expect(rows!.every((r) => r.xp === 10 && r.note?.startsWith("Streamed "))).toBe(true);
  // A second check inside a minute is refused instead of hammering ListenBrainz.
  await page.getByRole("button", { name: "Check my plays" }).click();
  await expect(page.getByText("Just checked. Try again in a minute.")).toBeVisible();
});

test("a bad token is refused and nothing is linked", async ({ page }) => {
  test.skip(!questId, "ListenBrainz unreachable or the public account has no recent listens");
  await admin().from("listen_accounts").delete().eq("fan_id", adminId);
  await signIn(page, ADMIN, `/${SLUG}/q/${questId}`);
  await page.getByLabel("ListenBrainz user token").fill("00000000-0000-0000-0000-000000000000");
  await page.getByRole("button", { name: "Connect ListenBrainz" }).click();
  await expect(page.getByText("ListenBrainz did not accept that token.", { exact: false })).toBeVisible({ timeout: 15_000 });
  const { count } = await admin().from("listen_accounts").select("fan_id", { count: "exact", head: true }).eq("fan_id", adminId);
  expect(count).toBe(0);
});
