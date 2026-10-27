"use client";
import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { claimReward, enterDraw } from "@/app/[channel]/actions";
import { useToast } from "@/components/Toast";
import { useJoin } from "@/components/JoinModal";
import { fmtEnds } from "@/lib/figma-format";
import { fmtXp } from "@/lib/format";
import type { Reward, RewardStat } from "@/lib/data";

export function RewardCard({ reward, stat, slug, signedIn, claimed, entered, lifetimeXp, image, tz, now }: {
  reward: Reward; stat: RewardStat | undefined; slug: string; signedIn: boolean; claimed: boolean; entered: boolean; lifetimeXp: number; image: string; tz: string; now: string;
}) {
  const [pending, start] = useTransition();
  const [delivery, setDelivery] = useState<{ type: string; payload: string | null } | null>(null);
  const { push } = useToast();
  const { open } = useJoin();
  const router = useRouter();
  const left = reward.stock == null ? null : Math.max(0, reward.stock - Number(stat?.claims ?? 0));
  const soldOut = reward.type === "claim" && left != null && left <= 0;
  const closed = reward.status === "closed" || (reward.draw_ends_at ? new Date(reward.draw_ends_at) <= new Date(now) : false);
  const locked = reward.min_lifetime_xp > 0 && lifetimeXp < reward.min_lifetime_xp;
  const line = reward.type === "draw"
    ? (reward.picked_at ? `Winner: ${stat?.winner_name ?? "A fan"}` : reward.draw_ends_at ? fmtEnds(reward.draw_ends_at, tz) : `${fmtXp(stat?.entries ?? 0)} entries`)
    : (left == null ? "Unlimited" : soldOut ? "Sold out" : `${fmtXp(left)} left`);

  function onClaim() {
    start(async () => {
      const r = await claimReward(slug, reward.id);
      if (!r.ok) return push(r.error, "error");
      setDelivery({ type: r.data.delivery_type, payload: r.data.delivery_payload });
      push("Claimed", "info");
      router.refresh();
    });
  }
  function onEnter() {
    start(async () => {
      const r = await enterDraw(slug, reward.id);
      if (!r.ok) return push(r.error, "error");
      push("You are in the draw", "info");
      router.refresh();
    });
  }

  let action: React.ReactNode;
  const label = reward.type === "claim" ? "Claim Offer" : "Enter Draw";
  if (!signedIn) action = <button type="button" className="fig-btn" onClick={() => open(`/${slug}#rewards`)}>{label}</button>;
  else if (locked) action = <span className="fig-btn fig-btn-outline" aria-disabled="true">Unlocks at {fmtXp(reward.min_lifetime_xp)} XP</span>;
  else if (reward.type === "claim") {
    if (claimed || delivery) action = <span className="fig-btn fig-btn-outline" aria-disabled="true">Claimed</span>;
    else if (soldOut) action = <span className="fig-btn fig-btn-outline" aria-disabled="true">Sold Out</span>;
    else action = <button type="button" className="fig-btn" disabled={pending} onClick={onClaim}>{label}</button>;
  } else {
    if (reward.picked_at || closed) action = <span className="fig-btn fig-btn-outline" aria-disabled="true">Closed</span>;
    else if (entered) action = <span className="fig-btn fig-btn-outline" aria-disabled="true">Entered</span>;
    else action = <button type="button" className="fig-btn" disabled={pending} onClick={onEnter}>{label}</button>;
  }
  const payload = delivery?.payload ?? (claimed ? reward.delivery_payload : null);
  const payloadType = delivery?.type ?? reward.delivery_type;

  return (
    <article className="fig-card-2 relative h-[416px] w-[319px] shrink-0 p-[25px] lg:h-[422px] lg:w-[399px]">
      <div className="relative h-[200px] w-[270px] overflow-hidden rounded-[8px] bg-section-dark lg:w-[350px]">
        <Image src={reward.image_url || image} alt="" fill className="object-cover" sizes="(min-width: 1024px) 350px, 270px" />
      </div>
      <h3 className="mt-[7px] flex h-[40px] items-center text-[16px] leading-[20px] lg:mt-[10px] lg:h-[48px] lg:text-[20px] lg:leading-[24px]"><span className="line-clamp-2">{reward.title}</span></h3>
      <p className="mt-[9px] text-[16px] leading-none lg:mt-[25px]">{line}</p>
      <div className="mt-[11px] w-[270px] lg:mt-[26px] lg:w-[352px]">{action}</div>
      {payload && (
        <p className="absolute inset-x-[25px] bottom-[6px] truncate text-[14px] leading-none">
          {payloadType === "link" ? <a className="underline" href={payload} target="_blank" rel="noopener noreferrer">Open your reward</a> : payloadType === "code" ? <>Code: <code>{payload}</code></> : payload}
        </p>
      )}
    </article>
  );
}
