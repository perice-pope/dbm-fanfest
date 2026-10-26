import { describe, it, expect } from "vitest";
import { periodKey, weekStart } from "@/lib/period";

describe("periodKey", () => {
  const tz = "America/Los_Angeles";
  it("uses the channel-local date", () => {
    // 06:30 UTC on Jan 2 is still Jan 1 in Los Angeles.
    const d = new Date("2026-01-02T06:30:00Z");
    expect(periodKey("daily", tz, d)).toBe("2026-01-01");
    expect(periodKey("daily", "UTC", d)).toBe("2026-01-02");
  });
  it("uses ISO weeks that start on Monday", () => {
    expect(periodKey("weekly", tz, new Date("2026-10-26T20:00:00Z"))).toBe("2026-W44"); // Monday Oct 26 2026
    expect(periodKey("weekly", tz, new Date("2026-10-25T20:00:00Z"))).toBe("2026-W43"); // Sunday
  });
  it("returns empty for once and per_item", () => {
    expect(periodKey("once", tz)).toBe("");
    expect(periodKey("per_item", tz)).toBe("");
  });
  it("finds the Monday of the week", () => {
    expect(weekStart(tz, new Date("2026-10-29T12:00:00Z")).toISOString().slice(0, 10)).toBe("2026-10-26");
  });
});
