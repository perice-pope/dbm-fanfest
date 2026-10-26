import { test, expect } from "@playwright/test";
import { SLUG, FAN1, signIn, resetTestFans, fanXp, questId, pngBuffer } from "./helpers";

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => { await resetTestFans(); });

test("daily visit pays once per day", async ({ page }) => {
  await signIn(page, FAN1);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Destroyed by Moths/i);
  await expect(page.getByText(/\+150 XP · Daily visit/)).toBeVisible({ timeout: 15_000 });
  await page.reload();
  await expect(page.locator("#quests article").filter({ hasText: "Daily visit reward" }).getByText("Done today")).toBeVisible();
  expect(await fanXp(FAN1)).toBe(150);
});

test("quiz grades on the server and pays partial XP", async ({ page }) => {
  await signIn(page, FAN1);
  await page.goto(`/${SLUG}/q/${await questId("How well do you know the Moths?")}`);
  const picks = [0, 1, 0, 0, 1]; // four right, one wrong
  for (let i = 0; i < picks.length; i++) await page.locator(`input[name="q${i}"]`).nth(picks[i]).check();
  await page.getByRole("button", { name: "Submit answers" }).click();
  await expect(page.getByText("4 of 5 right")).toBeVisible();
  await expect(page.getByText("+320 XP.")).toBeVisible();
  expect(await fanXp(FAN1)).toBe(150 + 320);
  await page.goto(`/${SLUG}/q/${await questId("How well do you know the Moths?")}`);
  await expect(page.getByText("Completed.")).toBeVisible();
});

test("poll pays once and shows completed after", async ({ page }) => {
  await signIn(page, FAN1);
  const id = await questId("What should we make next?");
  await page.goto(`/${SLUG}/q/${id}`);
  for (let i = 0; i < 4; i++) await page.locator(`input[name="q${i}"]`).first().check();
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByText("Thanks")).toBeVisible();
  expect(await fanXp(FAN1)).toBe(470 + 300);
  await page.goto(`/${SLUG}`);
  await expect(page.locator("#quests article").filter({ hasText: "What should we make next?" }).getByText("Completed")).toBeVisible();
});

test("email list signup pays once", async ({ page }) => {
  await signIn(page, FAN1);
  await page.goto(`/${SLUG}/q/${await questId("Join the Moths list")}`);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Join the list" }).click();
  await expect(page.getByText("You are on the list.")).toBeVisible();
  expect(await fanXp(FAN1)).toBe(770 + 100);
});

test("visit link pays on the click and redirects", async ({ page }) => {
  await signIn(page, FAN1);
  await page.route("https://open.spotify.com/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<html>spotify</html>" }));
  const id = await questId("Listen to our new single%");
  await page.goto(`/go/${SLUG}/${id}`);
  await expect(page).toHaveURL(/open\.spotify\.com/);
  expect(await fanXp(FAN1)).toBe(870 + 100);
  await page.goto(`/go/${SLUG}/${id}`);
  expect(await fanXp(FAN1)).toBe(970);
});

test("claim an offer and enter a draw", async ({ page }) => {
  await signIn(page, FAN1);
  const demo = page.locator("#rewards article").filter({ hasText: "Unreleased demo" });
  await demo.getByRole("button", { name: "Claim offer" }).click();
  await expect(demo.getByText("Claimed")).toBeVisible();
  await expect(demo.getByRole("link", { name: "Open your reward" })).toBeVisible();
  await page.reload();
  await expect(page.locator("#rewards article").filter({ hasText: "Unreleased demo" }).getByText("199 left")).toBeVisible();
  const draw = page.locator("#rewards article").filter({ hasText: "Jam session seat" });
  await draw.getByRole("button", { name: "Enter draw" }).click();
  await expect(draw.getByText("Entered")).toBeVisible();
});

test("social link goes to review", async ({ page }) => {
  await signIn(page, FAN1);
  await page.goto(`/${SLUG}/q/${await questId("Share \"Her Shoes\"")}`);
  await page.getByLabel("Link to your post").fill("https://www.instagram.com/p/ABC123/?igsh=xyz");
  await expect(page.getByText("instagram · instagram.com/p/ABC123")).toBeVisible();
  await page.getByLabel("Your handle on that platform").fill("@fanone");
  await page.getByRole("button", { name: "Submit link" }).click();
  await expect(page.getByText("Submitted")).toBeVisible();
  await page.goto(`/${SLUG}`);
  await expect(page.locator("#quests article").filter({ hasText: "Share" }).getByText("In review")).toBeVisible();
});

test("wrong host is refused before submit", async ({ page }) => {
  await signIn(page, FAN1);
  await page.goto(`/${SLUG}/q/${await questId("Tag us")}`);
  await page.getByLabel("Link to your post").fill("https://twitter.com/x/status/1");
  await page.getByLabel("Your handle on that platform").fill("@fanone");
  await page.getByRole("button", { name: "Submit link" }).click();
  await expect(page.getByText("Only Instagram, TikTok and Facebook links count.").first()).toBeVisible();
});

test("fan art pays on upload; playlist proof waits for review", async ({ page }) => {
  await signIn(page, FAN1);
  await page.goto(`/${SLUG}/q/${await questId("Recreate the album cover")}`);
  await page.locator('input[type="file"]').setInputFiles({ name: "art.png", mimeType: "image/png", buffer: pngBuffer(1) });
  await page.getByLabel("Caption").fill("Moth on a lamp");
  await page.getByText("The band may share this.").click();
  await page.getByText("I made this.").click();
  await page.getByRole("button", { name: "Upload and earn XP" }).click();
  await expect(page.getByText("Done", { exact: true })).toBeVisible({ timeout: 30_000 });
  expect(await fanXp(FAN1)).toBe(970 + 250);

  await page.goto(`/${SLUG}/q/${await questId("Playlist proof")}`);
  await page.locator('input[type="file"]').setInputFiles({ name: "playlist.png", mimeType: "image/png", buffer: pngBuffer(2) });
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.getByText("Submitted", { exact: true })).toBeVisible({ timeout: 30_000 });
  expect(await fanXp(FAN1)).toBe(1220);
});

test("leaderboard and activity show the fan", async ({ page }) => {
  await signIn(page, FAN1);
  await expect(page.getByRole("heading", { name: /Weekly leaderboard/ })).toBeVisible();
  const board = page.locator('section[aria-label="Leaderboard"]');
  await expect(board.getByText("Fan One")).toBeVisible();
  await expect(board.getByText("1,220").first()).toBeVisible();
  await expect(page.locator('section[aria-label="Recent activity"]').getByText("Fan One").first()).toBeVisible();
});

test("hidden fans leave the board but keep XP", async ({ page }) => {
  await signIn(page, FAN1, `/${SLUG}/account`);
  await page.getByLabel("Show me on the leaderboard").uncheck();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved")).toBeVisible();
  await page.goto(`/${SLUG}`);
  await expect(page.getByText("Hidden from leaderboard")).toBeVisible();
  await signIn(page, FAN1, `/${SLUG}/account`);
  await page.getByLabel("Show me on the leaderboard").check();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved")).toBeVisible();
});
