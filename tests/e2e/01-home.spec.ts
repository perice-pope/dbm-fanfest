import { test, expect } from "@playwright/test";
import { SLUG } from "./helpers";

const FANFEST = (process.env.NEXT_PUBLIC_FANFEST_URL || "https://beta.fanfest.vip/destroyedbymoths").replace(/\/$/, "");

test.describe("band website visitor", () => {
  test("the logo on the landing page leads to the band home page", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("list", { name: "Pages" }).first()).toBeVisible();
    await page.getByRole("link", { name: "Destroyed by Moths" }).click();
    await expect(page).toHaveURL(new RegExp(`/${SLUG}$`));
  });

  test("home shows the band header, News first, then Shows and Community, with no fan-club controls", async ({ page }) => {
    await page.goto(`/${SLUG}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Destroyed by Moths/i);
    await expect(page.getByRole("link", { name: "Sign Up" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Sign In" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Open chat" })).toHaveCount(0);
    const sections = page.locator("main section");
    await expect(sections.nth(0)).toHaveAttribute("aria-label", "News");
    await expect(sections.nth(1)).toHaveAttribute("aria-label", "Shows");
    await expect(sections.nth(2)).toHaveAttribute("aria-label", "Community");
    await expect(page.locator("#quests")).toHaveCount(0);
    await expect(page.locator("#rewards")).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Site" })).toBeVisible();
  });

  test("the Community link opens the FanFest channel", async ({ page }) => {
    await page.goto(`/${SLUG}`);
    const nav = page.getByRole("navigation", { name: "Site" });
    await expect(nav.getByRole("link", { name: "Community" })).toHaveAttribute("href", FANFEST);
    await expect(page.getByRole("link", { name: "Open the community" })).toHaveAttribute("href", FANFEST);
  });

  test("Shows and Merch pages render", async ({ page }) => {
    await page.goto(`/${SLUG}`);
    await page.getByRole("navigation", { name: "Site" }).getByRole("link", { name: "Shows" }).click();
    await expect(page).toHaveURL(new RegExp(`/${SLUG}/shows$`));
    await expect(page.getByRole("heading", { name: "Shows", exact: true })).toBeVisible();
    await expect(page.locator("main li").first()).toBeVisible();
    await page.goto(`/${SLUG}/merch`);
    await expect(page.getByRole("heading", { name: "Merch", exact: true })).toBeVisible();
  });

  test("privacy page and the retired leaderboard route still render", async ({ page }) => {
    await page.goto(`/${SLUG}/privacy`);
    await expect(page.getByRole("heading", { name: "Privacy settings" })).toBeVisible();
    await page.goto(`/${SLUG}/leaderboard?period=lifetime`);
    await expect(page.getByRole("heading", { name: "Leaderboard" })).toBeVisible();
  });
});
