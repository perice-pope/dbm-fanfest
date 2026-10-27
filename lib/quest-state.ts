import { periodKey, type RepeatRule } from "@/lib/period";
import type { Quest, Submission, LedgerRow } from "@/lib/data";

export type QuestState = "locked" | "expired" | "in_review" | "completed" | "rejected" | "available";

export type QuestView = {
  quest: Quest;
  state: QuestState;
  key: string;
  completedAt: string | null;
  latest: Submission | null;
  retryAllowed: boolean;
  resetsLabel: string | null;
};

export type QuestConfig = {
  questions?: { q: string; options: string[] }[];
  auto_approve?: boolean;
  kind?: "playlist" | "fan_art" | "merch_wild";
  hint?: string;
  rights?: string;
  consent?: string;
  variant?: string;
  cap?: number;
  image_url?: string;
};

export function configOf(q: Quest): QuestConfig {
  return (q.config ?? {}) as QuestConfig;
}

export const UPLOAD_TYPES = new Set(["photo_proof", "receipt_proof", "social_screenshot"]);
export const RESPONSE_TYPES = new Set(["quiz", "poll", "weekly_vote"]);

export function questView(
  quest: Quest,
  ctx: { tz: string; now: Date; lifetimeXp: number; ledger: LedgerRow[]; submissions: Submission[] },
): QuestView {
  const rule = (quest.type === "weekly_vote" ? "weekly" : quest.type === "daily_visit" ? "daily" : quest.repeat_rule) as RepeatRule;
  const key = periodKey(rule, ctx.tz, ctx.now);
  const subs = ctx.submissions.filter((s) => s.quest_id === quest.id);
  const latest = subs[0] ?? null;
  const paid = ctx.ledger.filter((l) => l.quest_id === quest.id && l.xp > 0);
  const completedRow = rule === "per_item" ? null : paid.find((l) => l.period_key === key) ?? null;
  const resetsLabel = rule === "daily" ? "Resets daily" : rule === "weekly" ? "Resets Monday" : rule === "monthly" ? "Resets monthly" : rule === "per_item" ? "Repeatable" : null;
  let state: QuestState = "available";
  let retryAllowed = false;
  if (quest.deadline && new Date(quest.deadline) <= ctx.now) state = "expired";
  else if (quest.lock_min_xp > 0 && ctx.lifetimeXp < quest.lock_min_xp) state = "locked";
  else if (latest?.status === "pending") state = "in_review";
  else if (completedRow) state = "completed";
  else if (latest?.status === "rejected") {
    if (latest.reject_mode === "final") state = "rejected";
    else {
      const retries = subs.filter((s) => s.status === "rejected").length;
      retryAllowed = retries < 2;
      state = retryAllowed ? "rejected" : "rejected";
    }
  }
  return { quest, state, key, completedAt: completedRow?.created_at ?? null, latest, retryAllowed, resetsLabel };
}

export const REJECT_REASONS: Record<string, string> = {
  not_visible: "We could not see what we needed in the proof.",
  wrong_item: "That was not the right item for this quest.",
  duplicate: "This was already submitted.",
  inappropriate: "This did not fit our community rules.",
};
