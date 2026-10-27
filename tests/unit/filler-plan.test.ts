import { describe, it, expect } from "vitest";
import { periodKey } from "@/lib/period";
import { makePlan, LIVE_QUESTS, ME, SEED_DOMAIN, type Plan } from "@/scripts/filler-plan.mts";

const tz = "America/Los_Angeles";
const now = new Date("2026-10-27T17:30:00Z"); // Tuesday 10:30 in Los Angeles
const plan: Plan = makePlan({ now, tz });
const quest = (title: string) => LIVE_QUESTS.find((q) => q.title === title);

describe("filler plan", () => {
  it("seeds 60 fans split 10/25/25 with seed emails and ordinary names", () => {
    expect(plan.fans).toHaveLength(60);
    const levels = plan.fans.reduce((m, f) => m.set(f.level, (m.get(f.level) ?? 0) + 1), new Map<string, number>());
    expect([levels.get("high"), levels.get("medium"), levels.get("low")]).toEqual([10, 25, 25]);
    expect(new Set(plan.fans.map((f) => f.email)).size).toBe(60);
    expect(new Set(plan.fans.map((f) => f.name)).size).toBe(60);
    for (const f of plan.fans) {
      expect(f.email.endsWith(`@${SEED_DOMAIN}`)).toBe(true);
      expect(f.name).toMatch(/^[A-Z][a-z]+ [A-Z]\.$/);
      expect(f.name).not.toMatch(/Amanda|Adam|Claire|Perice/);
      expect(f.createdAt.getTime()).toBeLessThanOrEqual(f.lastSeenAt.getTime());
      expect(f.lastSeenAt.getTime()).toBeLessThanOrEqual(now.getTime());
    }
  });

  it("never repeats a (fan, quest, period) and never dates a row in the future", () => {
    const seen = new Set<string>();
    for (const a of plan.awards) {
      const key = `${a.who}|${a.title}|${a.periodKey}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
      expect(a.at.getTime()).toBeLessThanOrEqual(now.getTime());
      expect(a.xp).toBeGreaterThan(0);
    }
  });

  it("only awards live quests with the app's source values", () => {
    const sources: Record<string, string[]> = {
      daily_visit: ["daily_visit"], visit_link: ["visit_link"], poll: ["poll"], quiz: ["quiz"], weekly_vote: ["weekly_vote"],
      email_signup: ["email_signup"], photo_proof: ["upload", "quest_approval"], receipt_proof: ["quest_approval"],
      social_link: ["quest_approval"], invite: ["invite"],
    };
    for (const a of plan.awards) {
      const q = quest(a.title);
      expect(q, a.title).toBeDefined();
      expect(sources[q!.type]).toContain(a.source);
      expect(a.xp).toBeLessThanOrEqual(q!.xp);
    }
    expect(plan.awards.find((a) => a.title === "Playlist proof")?.source).toBe("quest_approval");
    expect(plan.awards.find((a) => a.title === "Merch in the wild")?.source).toBe("upload");
  });

  it("shapes period keys by repeat rule and derives them from the row's own timestamp", () => {
    for (const a of plan.awards) {
      const rule = quest(a.title)!.repeat_rule;
      if (rule === "daily") {
        expect(a.periodKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(a.periodKey).toBe(periodKey("daily", tz, a.at));
      } else if (rule === "weekly") {
        expect(a.periodKey).toMatch(/^\d{4}-W\d{2}$/);
        expect(a.periodKey).toBe(periodKey("weekly", tz, a.at));
      } else if (rule === "once") expect(a.periodKey).toBe("");
      else expect(a.periodKey).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    }
  });

  it("earns a busy month and fills every board", () => {
    const month = periodKey("monthly", tz, now);
    const total = plan.awards.filter((a) => periodKey("monthly", tz, a.at) === month).reduce((s, a) => s + a.xp, 0);
    expect(total).toBeGreaterThanOrEqual(80_000);
    expect(total).toBeLessThanOrEqual(160_000);
    const week = periodKey("weekly", tz, now);
    expect(new Set(plan.awards.filter((a) => periodKey("weekly", tz, a.at) === week).map((a) => a.who)).size).toBeGreaterThanOrEqual(10);
    expect(new Set(plan.awards.map((a) => a.who)).size).toBe(61);
  });

  it("gives the owner the prescribed rows and honours the skip set", () => {
    const mine = plan.awards.filter((a) => a.who === ME);
    expect(mine.filter((a) => a.title === "Daily visit reward")).toHaveLength(20);
    expect(mine.filter((a) => a.title === "Song of the week").map((a) => a.periodKey).sort()).toEqual(["2026-W42", "2026-W43", "2026-W44"]);
    expect(mine.filter((a) => a.title === 'Share "Her Shoes"')).toHaveLength(2);
    expect(mine.filter((a) => a.title === "Recreate the album cover")).toHaveLength(2);
    for (const q of LIVE_QUESTS.filter((q) => q.repeat_rule === "once")) expect(mine.filter((a) => a.title === q.title)).toHaveLength(1);
    const skipped = makePlan({ now, tz, skipMine: new Set(["Daily visit reward\u00002026-10-27", "How well do you know the Moths?\u0000"]) });
    const left = skipped.awards.filter((a) => a.who === ME);
    expect(left.find((a) => a.periodKey === "2026-10-27")).toBeUndefined();
    expect(left.find((a) => a.title === "How well do you know the Moths?")).toBeUndefined();
    expect(left.filter((a) => a.title === "Daily visit reward")).toHaveLength(19);
  });

  it("is the same plan for the same now", () => {
    expect(makePlan({ now, tz })).toEqual(plan);
    expect(makePlan({ now: new Date("2026-10-28T17:30:00Z"), tz }).fans[0].createdAt).not.toEqual(plan.fans[0].createdAt);
  });

  it("writes a believable chat backlog", () => {
    expect(plan.chat.length).toBeGreaterThanOrEqual(130);
    expect(plan.chat.length).toBeLessThanOrEqual(160);
    expect(new Set(plan.chat.map((c) => c.body)).size).toBe(plan.chat.length);
    const mine = plan.chat.filter((c) => c.who === ME).length;
    expect(mine).toBeGreaterThanOrEqual(8);
    expect(mine).toBeLessThanOrEqual(10);
    const emails = new Set(plan.fans.map((f) => f.email));
    for (let i = 0; i < plan.chat.length; i++) {
      const c = plan.chat[i];
      expect(c.body.length).toBeGreaterThan(0);
      expect(c.body.length).toBeLessThanOrEqual(500);
      expect(c.who === ME || emails.has(c.who)).toBe(true);
      expect(c.at.getTime()).toBeGreaterThanOrEqual(now.getTime() - 10 * 86400000);
      if (i > 0) expect(c.at.getTime()).toBeGreaterThan(plan.chat[i - 1].at.getTime());
      if (i >= 2) expect(c.who === plan.chat[i - 1].who && c.who === plan.chat[i - 2].who).toBe(false);
    }
    const newest = now.getTime() - plan.chat[plan.chat.length - 1].at.getTime();
    expect(newest).toBeGreaterThanOrEqual(3 * 60000);
    expect(newest).toBeLessThanOrEqual(12 * 60000);
    const recent = plan.chat.filter((c) => c.at.getTime() >= now.getTime() - 48 * 3600000).length;
    expect(recent / plan.chat.length).toBeGreaterThan(0.3);
  });
});
