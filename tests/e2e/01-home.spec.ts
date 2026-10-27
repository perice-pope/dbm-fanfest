import { test, expect } from "@playwright/test";
import { SLUG } from "./helpers";

test.describe("anonymous visitor", () => {
  test("the logo on the landing page leads to the band channel", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Destroyed by Moths" }).click();
    await expect(page).toHaveURL(new RegExp(`/${SLUG}$`));
  });

  test("leaderboard is the first section on a phone and the shell is complete", async ({ page }) => {
    await page.goto(`/${SLUG}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Destroyed by Moths/i);
    await expect(page.getByRole("link", { name: "Sign Up" })).toBeVisible();
    const sections = page.locator("main section");
    await expect(sections.first()).toHaveAttribute("aria-label", "Leaderboard");
    await expect(page.getByRole("button", { name: "Sign up to see your rank" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Site" })).toBeVisible();
    await expect(page.locator("#quests article")).toHaveCount(17);
    await expect(page.locator("#rewards article")).toHaveCount(5);
    await expect(page.getByRole("button", { name: "Lifetime" })).toBeVisible();
    await expect(page.getByLabel("Fans online").first()).toBeVisible();
  });

  test("quest CTAs open the join modal for visitors, which leads to sign in", async ({ page }) => {
    await page.goto(`/${SLUG}`);
    await page.locator("#quests article").filter({ hasText: "How well do you know" }).getByRole("button", { name: "Play" }).click();
    const dialog = page.getByRole("dialog", { name: "Join or Sign In" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Earn XP, climb the leaderboard, unlock rewards.")).toBeVisible();
    await dialog.getByRole("link", { name: "Sign In" }).click();
    await expect(page).toHaveURL(/sign-in\?next=/);
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible();
  });

  test("landing page shows the band photo, page links and logo", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Destroyed by Moths" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Pages" }).first()).toBeVisible();
  });

  test("privacy page and full leaderboard render", async ({ page }) => {
    await page.goto(`/${SLUG}/privacy`);
    await expect(page.getByRole("heading", { name: "Privacy settings" })).toBeVisible();
    await page.goto(`/${SLUG}/leaderboard?period=lifetime`);
    await expect(page.getByRole("heading", { name: "Leaderboard" })).toBeVisible();
  });
});
