/** Postgres raises short codes; fans read sentences. */
const MESSAGES: Record<string, string> = {
  SIGN_IN_REQUIRED: "Sign in to earn XP.",
  NO_FAN: "We could not find your account. Sign in again.",
  BANNED: "This account cannot take part.",
  NO_CHANNEL: "This page does not exist.",
  QUEST_UNAVAILABLE: "This quest is not available.",
  QUEST_ENDED: "This quest has ended.",
  QUEST_LOCKED: "This quest unlocks at a higher lifetime XP.",
  WRONG_TYPE: "That action does not fit this quest.",
  WRONG_KIND: "That proof does not fit this quest.",
  QUIZ_NOT_READY: "This quiz is not set up yet.",
  ALREADY_DONE: "Already done for this period.",
  ALREADY_SUBMITTED: "That link, order number or photo has already been submitted.",
  BAD_LINK: "Only https links to Instagram, TikTok or Facebook posts count.",
  BAD_ORDER: "Type the order number from the receipt.",
  ALREADY_CLAIMED: "Already claimed.",
  ALREADY_ENTERED: "You are already in this draw.",
  DAILY_CAP: "You have hit today's submission limit. Try again tomorrow.",
  PENDING_CAP: "You have enough waiting for review. Check back after the band reviews them.",
  REJECT_BLOCK: "Three recent rejections pause new proofs for a while.",
  FINAL_REJECTED: "This quest is closed for you after a final rejection.",
  REWARD_UNAVAILABLE: "This reward is not available.",
  REWARD_LOCKED: "This reward unlocks at a higher lifetime XP.",
  SOLD_OUT: "Sold out.",
  DRAW_CLOSED: "This draw has closed.",
  FORBIDDEN: "You do not have permission to do that.",
  NOT_FOUND: "Not found.",
  NOT_CONNECTED: "Connect your ListenBrainz account first.",
  LB_BAD_TOKEN: "ListenBrainz did not accept that token. Copy it again from your ListenBrainz settings.",
  LB_TAKEN: "That ListenBrainz account is already linked to another fan.",
  LB_DOWN: "ListenBrainz is not answering right now. Try again in a few minutes.",
  LB_USER_GONE: "ListenBrainz cannot find your account any more. Disconnect and connect again.",
  SYNC_TOO_SOON: "Just checked. Try again in a minute.",
  NAME_REQUIRED: "Pick a display name in your account first.",
  EMPTY_MESSAGE: "Type a message first.",
  TOO_LONG: "Keep it under 500 characters.",
  SLOW_DOWN: "Slow down a little.",
  DUPLICATE_MESSAGE: "You just said that.",
};

export function friendlyError(err: unknown): string {
  const raw = (err as { message?: string })?.message ?? String(err);
  const code = Object.keys(MESSAGES).find((k) => raw.includes(k));
  return code ? MESSAGES[code] : "Something went wrong. Try again.";
}

export function errorCode(err: unknown): string | null {
  const raw = (err as { message?: string })?.message ?? String(err);
  return Object.keys(MESSAGES).find((k) => raw.includes(k)) ?? null;
}
