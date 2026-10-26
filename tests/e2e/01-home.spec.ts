import { test, expect } from "@playwright/test";
import { SLUG } from "./helpers";

test.describe("anonymous visitor", () => {
  test("root redirects to the band channel", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(new RegExp(`/${SLUG}$`));
  });

  test("leaderboard is the first section on a phone and the shell is complete", async ({ page }) => {
    await page.goto(`/${SLUG}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Destroyed by Moths/i);
    await expect(page.getByText("Browsing anonymously")).toBeVisible();
    const sections = page.locator("main section");
    await expect(sections.first()).toHaveAttribute("aria-label", "Leaderboard");
    await expect(page.getByText("Sign up to see your rank")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Sections" })).toBeVisible();
    await expect(page.locator("#quests article")).toHaveCount(17);
    await expect(page.locator("#rewards article")).toHaveCount(5);
    await expect(page.getByRole("button", { name: "Lifetime" })).toBeVisible();
  });

  test("quest CTAs send visitors to sign in", async ({ page }) => {
    await page.goto(`/${SLUG}`);
    await page.locator("#quests article").filter({ hasText: "How well do you know" }).getByRole("link", { name: "Play" }).click();
    await expect(page).toHaveURL(/sign-in\?next=/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  test("privacy page and full leaderboard render", async ({ page }) => {
    await page.goto(`/${SLUG}/privacy`);
    await expect(page.getByRole("heading", { name: "Privacy settings" })).toBeVisible();
    await page.goto(`/${SLUG}/leaderboard?period=lifetime`);
    await expect(page.getByRole("heading", { name: "Leaderboard" })).toBeVisible();
  });
});
