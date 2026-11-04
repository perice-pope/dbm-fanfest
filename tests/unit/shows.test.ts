import { describe, expect, it } from "vitest";
import { formatShowDate, splitShows, todayKey, type Show } from "@/lib/shows";

const show = (date: string): Show => ({ id: date, date, city: "LA", venue: "V", status: "on_sale" });

describe("shows", () => {
  it("splits upcoming (today included, soonest first) from past (latest first)", () => {
    const { upcoming, past } = splitShows([show("2026-12-05"), show("2026-09-12"), show("2026-11-04"), show("2026-10-01")], "2026-11-04");
    expect(upcoming.map((s) => s.date)).toEqual(["2026-11-04", "2026-12-05"]);
    expect(past.map((s) => s.date)).toEqual(["2026-10-01", "2026-09-12"]);
  });
  it("formats the calendar date without a timezone shift", () => {
    expect(formatShowDate("2026-12-05")).toBe("SAT 5 DEC 2026");
  });
  it("uses the channel's day for today", () => {
    expect(todayKey("America/Los_Angeles", new Date("2026-11-05T03:00:00Z"))).toBe("2026-11-04");
    expect(todayKey("UTC", new Date("2026-11-05T03:00:00Z"))).toBe("2026-11-05");
  });
});
