"use client";
import Image from "next/image";
import { GatedLink } from "@/components/JoinModal";
import { fmtEnds } from "@/lib/figma-format";
import { fmtXp } from "@/lib/format";
import { REJECT_REASONS, type QuestView } from "@/lib/quest-state";

const CTA: Record<string, string> = {
  daily_visit: "Awarded on Arrival", visit_link: "Check It Out Now", invite: "Invite", quiz: "Play Now", poll: "Respond", weekly_vote: "Vote",
  photo_proof: "Submit Proof", receipt_proof: "Submit Proof", social_link: "Submit Link", social_screenshot: "Submit Proof", email_signup: "Join the List", listen: "Connect & Stream",
};

function titleCase(s: string) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function QuestCard({ view, slug, tz, signedIn, image, now }: { view: QuestView; slug: string; tz: string; signedIn: boolean; image: string; now: string }) {
  const { quest, state, latest } = view;
  const detailHref = `/${slug}/q/${quest.id}`;
  const cta = quest.cta_label ? titleCase(quest.cta_label) : CTA[quest.type] ?? "Open";
  const ended = quest.deadline ? new Date(quest.deadline) <= new Date(now) : false;
  const line = quest.deadline && !ended ? fmtEnds(quest.deadline, tz) : view.resetsLabel ?? (ended ? "Ended" : "No end date");

  let action: React.ReactNode;
  if (state === "expired") action = <span className="fig-btn fig-btn-outline" aria-disabled="true">Ended</span>;
  else if (state === "locked") action = <span className="fig-btn fig-btn-outline" aria-disabled="true">Unlocks at {fmtXp(quest.lock_min_xp)} XP</span>;
  else if (state === "in_review") action = <span className="fig-btn fig-btn-outline" aria-disabled="true">In Review</span>;
  else if (state === "completed") action = <span className="fig-btn fig-btn-outline" aria-disabled="true">{quest.type === "daily_visit" ? "Awarded on Arrival" : "Completed"}</span>;
  else if (state === "rejected" && (latest?.reject_mode === "final" || !view.retryAllowed)) action = <span className="fig-btn fig-btn-outline" aria-disabled="true">Closed</span>;
  else if (quest.type === "daily_visit") action = <span className="fig-btn fig-btn-outline" aria-disabled="true">Awarded on Arrival</span>;
  else if (quest.type === "visit_link") action = <GatedLink href={`/go/${slug}/${quest.id}`} signedIn={signedIn} className="fig-btn">{cta}</GatedLink>;
  else action = <GatedLink href={detailHref} signedIn={signedIn} className="fig-btn">{state === "rejected" ? "Try Again" : cta}</GatedLink>;

  return (
    <article className="fig-card relative h-[416px] w-[319px] shrink-0 p-[25px] lg:h-[422px] lg:w-[399px]">
      <div className="relative h-[200px] w-[270px] overflow-hidden rounded-[8px] bg-section-dark lg:w-[350px]">
        <Image src={image} alt="" fill className="object-cover" sizes="(min-width: 1024px) 350px, 270px" />
        <span className="fig-badge absolute right-[20px] top-[18px] max-lg:right-[16px] max-lg:top-[17px]">{fmtXp(quest.xp)} XP</span>
      </div>
      <h3 className="mt-[7px] flex h-[40px] items-center text-[16px] leading-[20px] lg:mt-[10px] lg:h-[48px] lg:text-[20px] lg:leading-[24px]">
        <span className="line-clamp-2">{quest.title}</span>
      </h3>
      <p className="mt-[9px] text-[16px] leading-none lg:mt-[25px]">{line}</p>
      {state === "rejected" && latest?.reject_reason && <p className="sr-only">{REJECT_REASONS[latest.reject_reason]}</p>}
      <div className="mt-[11px] w-[270px] lg:mt-[26px] lg:w-[352px]">{action}</div>
    </article>
  );
}
