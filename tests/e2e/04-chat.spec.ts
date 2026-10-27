import { test, expect, type Page } from "@playwright/test";
import { SLUG, ADMIN, FAN2, signIn, resetTestFans } from "./helpers";

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => { await resetTestFans(); });

let posted = "";
let postedAt = 0;

async function openChat(page: Page) {
  await page.getByRole("button", { name: "Open chat", exact: true }).first().click();
  const dialog = page.getByRole("dialog", { name: "Chat", exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function send(page: Page, body: string) {
  const input = page.getByRole("dialog", { name: "Chat", exact: true }).getByRole("textbox", { name: "Message", exact: true });
  await input.fill(body);
  await input.press("Enter");
}

test("visitors can read the chat but must sign in to post", async ({ page }) => {
  await page.goto(`/${SLUG}`);
  const dialog = await openChat(page);
  await expect(dialog.getByRole("list", { name: "Messages" })).toBeVisible();
  await dialog.getByRole("button", { name: "Sign in to chat" }).click();
  const join = page.getByRole("dialog", { name: "Join or Sign In" });
  await expect(join).toBeVisible();
  await expect(join.getByText("Earn XP, climb the leaderboard, unlock rewards.")).toBeVisible();
});

test("a fan's message posts and survives a reload", async ({ page }) => {
  await signIn(page, FAN2);
  const dialog = await openChat(page);
  posted = `e2e ${Date.now()}`;
  await send(page, posted);
  postedAt = Date.now();
  await expect(dialog.getByRole("list", { name: "Messages" }).getByText(posted)).toBeVisible();
  await page.reload();
  const again = await openChat(page);
  await expect(again.getByRole("list", { name: "Messages" }).getByText(posted)).toBeVisible();
});

test("a fourth message within ten seconds is refused", async ({ page }) => {
  await signIn(page, FAN2);
  const dialog = await openChat(page);
  const list = dialog.getByRole("list", { name: "Messages" });
  // The limit counts the previous test's message too, so let its ten seconds pass first.
  await page.waitForTimeout(Math.max(0, 10_500 - (Date.now() - postedAt)));
  for (let i = 1; i <= 3; i++) {
    const body = `e2e burst ${i} ${Date.now()}`;
    await send(page, body);
    await expect(list.getByText(body)).toBeVisible();
  }
  await send(page, `e2e burst 4 ${Date.now()}`);
  await expect(page.getByText("Slow down a little.").first()).toBeVisible();
});

test("an admin can delete another fan's message", async ({ page }) => {
  await signIn(page, ADMIN);
  const dialog = await openChat(page);
  const item = dialog.getByRole("list", { name: "Messages" }).getByRole("listitem").filter({ hasText: posted });
  await expect(item).toBeVisible();
  await item.getByRole("button", { name: "Delete message" }).click();
  await expect(item).toHaveCount(0);
});
