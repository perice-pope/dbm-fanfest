"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { claimReward, enterDraw } from "@/app/[channel]/actions";
import { useToast } from "@/components/Toast";
import { fmtXp, timeLeft } from "@/lib/format";
import type { Reward, RewardStat } from "@/lib/data";

export function RewardCard({ reward, stat, slug, signedIn, claimed, entered, lifetimeXp }: {
  reward: Reward; stat: RewardStat | undefined; slug: string; signedIn: boolean; claimed: boolean; entered: boolean; lifetimeXp: number;
}) {
  const [pending, start] = useTransition();
  const [delivery, setDelivery] = useState<{ type: string; payload: string | null } | null>(null);
  const { push } = useToast();
  const router = useRouter();
  const left = reward.stock == null ? null : Math.max(0, reward.stock - Number(stat?.claims ?? 0));
  const soldOut = reward.type === "claim" && left != null && left <= 0;
  const closed = reward.status === "closed" || (reward.draw_ends_at ? new Date(reward.draw_ends_at) <= new Date() : false);
  const locked = reward.min_lifetime_xp > 0 && lifetimeXp < reward.min_lifetime_xp;
  const signInHref = `/${slug}/sign-in?next=${encodeURIComponent(`/${slug}#rewards`)}`;

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

  let meta: string;
  if (reward.type === "claim") meta = left == null ? "Unlimited" : soldOut ? "Sold out" : `${fmtXp(left)} left`;
  else if (reward.picked_at) meta = `Winner: ${stat?.winner_name ?? "A fan"}`;
  else meta = Number(stat?.entries ?? 0) === 0 ? "No entries yet" : `${fmtXp(stat?.entries ?? 0)} entries${reward.draw_ends_at ? ` · ${timeLeft(reward.draw_ends_at)}` : ""}`;

  let action: React.ReactNode;
  if (!signedIn) action = <Link href={signInHref} className="btn btn-primary">{reward.type === "claim" ? "Claim offer" : "Enter draw"}</Link>;
  else if (locked) action = <span className="label">Unlocks at {fmtXp(reward.min_lifetime_xp)} XP</span>;
  else if (reward.type === "claim") {
    if (claimed || delivery) action = <span className="label border-success/40 text-success">Claimed</span>;
    else if (soldOut) action = <span className="label">Sold out</span>;
    else action = <button type="button" className="btn btn-primary" disabled={pending} onClick={onClaim}>Claim offer</button>;
  } else {
    if (reward.picked_at || closed) action = <span className="label">Closed</span>;
    else if (entered) action = <span className="label border-success/40 text-success">Entered</span>;
    else action = <button type="button" className="btn btn-primary" disabled={pending} onClick={onEnter}>Enter draw</button>;
  }

  return (
    <article className="card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="label">{reward.type === "claim" ? "Offer" : "Draw"}</span>
        <span className="text-xs text-muted">{meta}</span>
      </div>
      <h3 className="display mt-3 text-2xl leading-none">{reward.title}</h3>
      {reward.body && <p className="mt-2 text-sm text-muted">{reward.body}</p>}
      {(delivery || (claimed && reward.delivery_payload)) && (
        <div className="mt-3 rounded-[var(--radius-sm)] bg-surface-2 p-3 text-sm">
          {(delivery?.type ?? reward.delivery_type) === "link" ? (
            <a className="text-accent underline" href={delivery?.payload ?? reward.delivery_payload ?? "#"} target="_blank" rel="noopener noreferrer">Open your reward</a>
          ) : (delivery?.type ?? reward.delivery_type) === "code" ? (
            <span>Your code: <code className="rounded bg-bg px-2 py-0.5">{delivery?.payload ?? reward.delivery_payload}</code></span>
          ) : (
            <span>{delivery?.payload ?? reward.delivery_payload}</span>
          )}
        </div>
      )}
      <div className="mt-4 flex justify-end">{action}</div>
    </article>
  );
}
