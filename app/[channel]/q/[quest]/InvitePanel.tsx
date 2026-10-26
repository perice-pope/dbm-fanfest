"use client";
import { useToast } from "@/components/Toast";
import { fmtXp } from "@/lib/format";

export function InvitePanel({ slug, code, xp, cap, converted, origin }: { slug: string; code: string; xp: number; cap: number; converted: number; origin: string }) {
  const link = `${origin}/${slug}?ref=${code}`;
  const { push } = useToast();
  async function copy() {
    try { await navigator.clipboard.writeText(link); push("Link copied", "info"); } catch { push("Copy failed. Select the link and copy it.", "error"); }
  }
  async function share() {
    if (navigator.share) {
      try { await navigator.share({ title: "Join me on FanFest", url: link }); } catch { /* cancelled */ }
    } else copy();
  }
  return (
    <div className="card space-y-3 p-5">
      <p className="text-sm text-muted">Share your link. When a friend signs up through it and completes their first quest, you earn {fmtXp(xp)} XP. Up to {cap} friends count.</p>
      <input readOnly className="input" value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Your invite link" />
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn btn-secondary" onClick={copy}>Copy link</button>
        <button type="button" className="btn btn-primary" onClick={share}>Share</button>
      </div>
      <p className="text-xs text-muted">{converted} of {cap} friends counted so far.</p>
    </div>
  );
}
