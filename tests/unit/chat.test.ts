import { describe, it, expect } from "vitest";
import { CHAT_PAGE, mergeMessages, onlineLabel, replaceWindow, type ChatMessage } from "@/lib/chat";

const at = (i: number) => new Date(Date.UTC(2026, 9, 27, 12, 0, i)).toISOString();
const msg = (i: number, body = `m${i}`): ChatMessage => ({ id: `id-${String(i).padStart(3, "0")}`, fan_id: "f", display_name: "A fan", body, created_at: at(i), is_admin: false });
const range = (from: number, to: number) => Array.from({ length: to - from }, (_, k) => msg(from + k));

describe("mergeMessages", () => {
  it("adds by id, overwrites, and keeps rows oldest first", () => {
    const merged = mergeMessages([msg(2), msg(1)], [msg(3), msg(2, "edited")]);
    expect(merged.map((m) => m.id)).toEqual(["id-001", "id-002", "id-003"]);
    expect(merged[1].body).toBe("edited");
  });
});

describe("replaceWindow", () => {
  it("drops rows the server no longer returns when the page is short", () => {
    const next = replaceWindow([msg(1), msg(2), msg(3)], [msg(1), msg(3)]);
    expect(next.map((m) => m.id)).toEqual(["id-001", "id-003"]);
  });

  it("keeps rows older than a full page and replaces the window it covers", () => {
    const earlier = range(0, 10);
    const page = range(10, 10 + CHAT_PAGE);
    const current = mergeMessages(earlier, page);
    const deleted = page[7].id;
    const incoming = [...page.filter((m) => m.id !== deleted), msg(10 + CHAT_PAGE)].slice(-CHAT_PAGE);
    const next = replaceWindow(current, incoming);
    expect(next.length).toBe(earlier.length + CHAT_PAGE);
    expect(next.some((m) => m.id === deleted)).toBe(false);
    expect(next.slice(0, 10)).toEqual(earlier);
    expect(next.at(-1)?.id).toBe(msg(10 + CHAT_PAGE).id);
  });

  it("is a plain merge when nothing was loaded yet", () => {
    expect(replaceWindow([], [msg(2), msg(1)]).map((m) => m.id)).toEqual(["id-001", "id-002"]);
  });
});

describe("onlineLabel", () => {
  it("pluralises", () => {
    expect(onlineLabel(1)).toBe("1 FAN ONLINE");
    expect(onlineLabel(0)).toBe("0 FANS ONLINE");
    expect(onlineLabel(12)).toBe("12 FANS ONLINE");
  });
});
