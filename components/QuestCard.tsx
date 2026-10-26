"use client";
import { useState } from "react";
import Link from "next/link";
import { fmtXp, fmtDeadline } from "@/lib/format";
import { REJECT_REASONS, type QuestView } from "@/lib/quest-state";

const CTA: Record<string, string> = {
  daily_visit: "Awarded on arrival", visit_link: "Visit link", invite: "Invite", quiz: "Play", poll: "Respond", weekly_vote: "Respond",
  photo_proof: "Submit proof", receipt_proof: "Submit proof", social_link: "Submit link", social_screenshot: "Submit proof", email_signup: "Join list",
};

export function QuestCard({ view, slug, tz, signedIn }: { view: QuestView; slug: string; tz: string; signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const { quest, state, latest } = view;
  const detailHref = `/${slug}/q/${quest.id}`;
  const signInHref = `/${slug}/sign-in?next=${encodeURIComponent(detailHref)}`;
  const cta = quest.cta_label ?? CTA[quest.type] ?? "Open";
  const isStatusOnly = quest.type === "daily_visit";

  let action: React.ReactNode;
  if (state === "expired") action = <span className="label">Ended</span>;
  else if (state === "locked") action = <span className="label">Locked · {fmtXp(quest.lock_min_xp)} XP</span>;
  else if (state === "in_review") action = <span className="label">In review</span>;
  else if (state === "completed") action = <span className="label border-success/40 text-success">{quest.type === "daily_visit" ? "Done today" : "Completed"}</span>;
  else if (state === "rejected" && latest?.reject_mode === "final") action = <span className="label border-danger/40 text-danger">Closed</span>;
  else if (isStatusOnly) action = <span className="label">{signedIn ? cta : "Sign in to earn"}</span>;
  else if (!signedIn) action = <Link href={signInHref} className="btn btn-primary">{cta}</Link>;
  else if (quest.type === "visit_link") action = <a href={`/go/${slug}/${quest.id}`} className="btn btn-primary">{cta}</a>;
  else action = <Link href={detailHref} className="btn btn-primary">{state === "rejected" ? "Try again" : cta}</Link>;

  return (
    <article className={`card p-4 sm:p-5 ${state === "expired" || state === "locked" ? "opacity-70" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <span className="badge-xp">{fmtXp(quest.xp)} XP</span>
        <button type="button" aria-expanded={open} aria-label="Quest details" className="rounded-full p-1 text-muted hover:text-text" onClick={() => setOpen((o) => !o)}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className={`transition-transform ${open ? "rotate-180" : ""}`}><path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>
      <h3 className="display mt-3 text-2xl leading-none">{quest.title}</h3>
      {quest.description && <p className="mt-2 text-sm text-muted">{quest.description}</p>}
      {quest.deadline && state !== "expired" && <p className="mt-2 text-xs uppercase tracking-[0.12em] text-muted">Ends {fmtDeadline(quest.deadline, tz)}</p>}
      {state === "rejected" && latest?.reject_reason && (
        <p className="mt-2 text-sm text-danger">{REJECT_REASONS[latest.reject_reason] ?? "Not approved."}{latest.reject_note ? ` ${latest.reject_note}` : ""}{latest.reject_mode !== "final" && view.retryAllowed ? " You can try once more." : ""}</p>
      )}
      {open && (
        <dl className="mt-3 grid grid-cols-2 gap-2 rounded-[var(--radius-sm)] bg-surface-2 p-3 text-xs text-muted">
          <dt>Repeats</dt><dd className="text-text">{view.resetsLabel ?? "Once"}</dd>
          <dt>Verified by</dt><dd className="text-text">{verifiedBy(quest.type, Boolean((quest.config as { auto_approve?: boolean })?.auto_approve))}</dd>
          {quest.lock_min_xp > 0 && (<><dt>Unlocks at</dt><dd className="text-text">{fmtXp(quest.lock_min_xp)} lifetime XP</dd></>)}
          {state === "in_review" && (<><dt>Status</dt><dd className="text-text">Waiting for the band</dd></>)}
        </dl>
      )}
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-xs text-muted">{view.resetsLabel ?? ""}</span>
        {action}
      </div>
    </article>
  );
}

function verifiedBy(type: string, auto: boolean) {
  switch (type) {
    case "daily_visit": case "visit_link": case "email_signup": case "poll": case "weekly_vote": case "invite": return "The site, instantly";
    case "quiz": return "Graded instantly";
    case "photo_proof": return auto ? "Instant, reviewed after" : "The band, one tap";
    default: return "The band, one tap";
  }
}
