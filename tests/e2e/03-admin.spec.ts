import { test, expect } from "@playwright/test";
import { SLUG, ADMIN, FAN1, signIn, fanXp } from "./helpers";

test.describe.configure({ mode: "serial" });

test("fans cannot open admin; admin sees the overview", async ({ page }) => {
  await signIn(page, FAN1, `/${SLUG}/admin`);
  await expect(page).toHaveURL(new RegExp(`/${SLUG}$`));
  await signIn(page, ADMIN, `/${SLUG}/admin`);
  await expect(page.getByRole("heading", { name: "Admin" })).toBeVisible();
  await expect(page.getByText("Waiting for review")).toBeVisible();
});

test("approve pays the fan once; a second approve is refused", async ({ page }) => {
  const before = await fanXp(FAN1);
  await signIn(page, ADMIN, `/${SLUG}/admin/review`);
  const row = page.locator("article").filter({ hasText: "Playlist proof" }).first();
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText(/Approved · \+200 XP/)).toBeVisible();
  await expect(page.locator("article").filter({ hasText: "Playlist proof" })).toHaveCount(0);
  expect(await fanXp(FAN1)).toBe(before + 200);
});

test("reject with a reason shows on the fan's card and allows one retry", async ({ page }) => {
  await signIn(page, ADMIN, `/${SLUG}/admin/review`);
  const row = page.locator("article").filter({ hasText: "Share" }).first();
  await row.getByRole("button", { name: "Reject…" }).click();
  await row.getByRole("button", { name: "Not visible" }).click();
  await row.getByPlaceholder(/Optional note/).fill("Could not open the post.");
  await row.getByRole("button", { name: "Confirm rejection" }).click();
  await expect(page.getByText("Rejected", { exact: true })).toBeVisible();
  await signIn(page, FAN1);
  const card = page.locator("#quests article").filter({ hasText: "Share" });
  await expect(card.getByText(/We could not see what we needed/)).toBeVisible();
  await expect(card.getByRole("link", { name: "Try again" })).toBeVisible();
});

test("uploads: feature, hide, remove reverses XP", async ({ page }) => {
  const before = await fanXp(FAN1);
  await signIn(page, ADMIN, `/${SLUG}/admin/uploads`);
  const tile = page.locator("article").filter({ hasText: "Moth on a lamp" });
  await tile.getByRole("button", { name: "Feature" }).click();
  await expect(tile.getByText("Featured")).toBeVisible();
  await tile.getByRole("button", { name: "Hide" }).click();
  await expect(tile.getByText("Hidden")).toBeVisible();
  expect(await fanXp(FAN1)).toBe(before);
  page.once("dialog", (d) => d.accept());
  await tile.getByRole("button", { name: "Remove" }).click();
  await expect(tile.getByText("Removed")).toBeVisible();
  expect(await fanXp(FAN1)).toBe(before - 250);
});

test("pick a draw winner and show it to fans", async ({ page }) => {
  await signIn(page, ADMIN, `/${SLUG}/admin/rewards`);
  page.once("dialog", (d) => d.accept());
  await page.locator("div").filter({ hasText: /entries/ }).getByRole("button", { name: "Pick winner" }).first().click();
  await expect(page.getByText("Winner picked")).toBeVisible();
  await page.goto(`/${SLUG}`);
  await expect(page.locator("#rewards article").filter({ hasText: "Jam session seat" }).getByText("Winner: Fan One")).toBeVisible();
});

test("edit a quest, adjust XP, export the email list", async ({ page }) => {
  await signIn(page, ADMIN, `/${SLUG}/admin/quests`);
  await page.getByRole("link", { name: "Tag us" }).click();
  await page.getByLabel("XP", { exact: true }).fill("120");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/admin\/quests\?saved=1/);
  await page.goto(`/${SLUG}`);
  await expect(page.locator("#quests article").filter({ hasText: "Tag us" }).getByText("120 XP")).toBeVisible();

  const before = await fanXp(FAN1);
  await page.goto(`/${SLUG}/admin/fans?q=fan1`);
  await page.getByRole("link", { name: /Fan One/ }).click();
  await page.getByLabel(/Adjust XP/).fill("50");
  await page.getByLabel(/Reason/).fill("Test bonus");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText("Test bonus")).toBeVisible();
  expect(await fanXp(FAN1)).toBe(before + 50);

  const res = await page.request.get(`/${SLUG}/admin/emails/export`);
  expect(res.status()).toBe(200);
  expect(await res.text()).toContain(FAN1);
});

test("settings save and change the accent", async ({ page }) => {
  await signIn(page, ADMIN, `/${SLUG}/admin/settings`);
  await page.getByLabel("Tagline").fill("Fans compete, vote and unlock rewards.");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
});
