import { describe, it, expect } from "vitest";
import { normalizeSocialLink } from "@/lib/links";

describe("normalizeSocialLink", () => {
  it("accepts instagram and strips tracking", () => {
    const r = normalizeSocialLink("https://www.instagram.com/p/ABC123/?igsh=xyz&utm_source=ig");
    expect(r.ok && r.normalized).toBe("instagram.com/p/ABC123");
    expect(r.ok && r.platform).toBe("instagram");
  });
  it("keeps facebook ids in the query", () => {
    const r = normalizeSocialLink("https://m.facebook.com/story.php?story_fbid=123&id=456&fbclid=zzz");
    expect(r.ok && r.normalized).toBe("facebook.com/story.php?story_fbid=123&id=456");
  });
  it("accepts tiktok short links", () => {
    const r = normalizeSocialLink("https://vm.tiktok.com/ZMabc/");
    expect(r.ok && r.normalized).toBe("vm.tiktok.com/ZMabc");
  });
  it("rejects other hosts and http", () => {
    expect(normalizeSocialLink("https://twitter.com/x/status/1").ok).toBe(false);
    expect(normalizeSocialLink("http://instagram.com/p/ABC").ok).toBe(false);
    expect(normalizeSocialLink("not a url").ok).toBe(false);
  });
  it("is case sensitive in the path", () => {
    const a = normalizeSocialLink("https://instagram.com/p/AbC");
    const b = normalizeSocialLink("https://INSTAGRAM.com/p/abc");
    expect(a.ok && b.ok && a.normalized !== b.normalized).toBe(true);
  });
});
