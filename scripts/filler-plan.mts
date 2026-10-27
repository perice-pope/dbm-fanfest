// The filler plan: 60 seeded fans, their XP history, the owner's extra rows and a chat backlog, all derived from a
// fixed "now" and per-fan RNGs seeded from emails, so re-runs give the same people. Pure: no I/O, no ids.
// scripts/seed-filler.mts writes it; tests/unit/filler-plan.test.ts checks it.
import { periodKey, weekStart } from "../lib/period.ts";

export type Level = "high" | "medium" | "low";
export type QuestInfo = { title: string; type: string; xp: number; repeat_rule: string };
export type FillerFan = { email: string; name: string; level: Level };
export type PlannedFan = FillerFan & { createdAt: Date; lastSeenAt: Date };
export type PlannedAward = { who: string; title: string; source: string; periodKey: string; xp: number; at: Date };
export type PlannedChat = { who: string; body: string; at: Date };
export type Plan = { fans: PlannedFan[]; awards: PlannedAward[]; chat: PlannedChat[] };
export type PlanOptions = { now: Date; tz: string; quests?: QuestInfo[]; skipMine?: Set<string> };

/** Stands in for the owner's fan id in `who`; the seeder maps it. */
export const ME = "me";
export const SEED_DOMAIN = "seed.dbm";
export const HISTORY_DAYS = 75;
export const CHAT_DAYS = 10;
/** One (quest, period) pair, for the uniqueness guard and the owner's skip set. */
export const awardKey = (title: string, period: string) => `${title}\u0000${period}`;

/** The live quests the plan is tuned for. The seeder passes the real rows; titles must match. */
export const LIVE_QUESTS: QuestInfo[] = [
  { title: "Daily visit reward", type: "daily_visit", xp: 150, repeat_rule: "daily" },
  { title: "Visit the merch store", type: "visit_link", xp: 50, repeat_rule: "daily" },
  { title: 'Listen to our new single "Her Shoes"', type: "visit_link", xp: 100, repeat_rule: "once" },
  { title: "Join the Moths list", type: "email_signup", xp: 100, repeat_rule: "once" },
  { title: "What should we make next?", type: "poll", xp: 300, repeat_rule: "once" },
  { title: "Plan our first tour", type: "poll", xp: 300, repeat_rule: "once" },
  { title: "Build the first live setlist", type: "poll", xp: 150, repeat_rule: "once" },
  { title: "Which song gets a session take?", type: "poll", xp: 100, repeat_rule: "once" },
  { title: "How well do you know the Moths?", type: "quiz", xp: 400, repeat_rule: "once" },
  { title: "Playlist proof", type: "photo_proof", xp: 200, repeat_rule: "once" },
  { title: "Merch in the wild", type: "photo_proof", xp: 300, repeat_rule: "once" },
  { title: "Song of the week", type: "weekly_vote", xp: 250, repeat_rule: "weekly" },
  { title: 'Share "Her Shoes"', type: "social_link", xp: 100, repeat_rule: "weekly" },
  { title: "Tag us", type: "social_link", xp: 100, repeat_rule: "weekly" },
  { title: "Recreate the album cover", type: "photo_proof", xp: 250, repeat_rule: "weekly" },
  { title: "Show your Moths merch", type: "receipt_proof", xp: 300, repeat_rule: "per_item" },
  { title: "Invite friends", type: "invite", xp: 1000, repeat_rule: "per_item" },
];

/** The source the app writes for a quest's rows: photo proofs pay on upload except the reviewed playlist screenshot. */
export function sourceFor(q: QuestInfo): string {
  if (q.type === "photo_proof") return q.title === "Playlist proof" ? "quest_approval" : "upload";
  if (q.type === "receipt_proof" || q.type === "social_link" || q.type === "social_screenshot") return "quest_approval";
  return q.type;
}

type Rates = Record<Level, number>;
const VISIT: Rates = { high: 0.8, medium: 0.4, low: 0.12 };
const ONCE: Rates = { high: 0.9, medium: 0.55, low: 0.25 };
const WEEKLY: Record<string, Rates> = {
  "Song of the week": { high: 0.8, medium: 0.5, low: 0.2 },
  'Share "Her Shoes"': { high: 0.5, medium: 0.3, low: 0.1 },
  "Tag us": { high: 0.4, medium: 0.2, low: 0.05 },
  "Recreate the album cover": { high: 0.3, medium: 0.15, low: 0.05 },
};
const WEEKLY_DEFAULT: Rates = { high: 0.3, medium: 0.15, low: 0.05 };
const MERCH_LINK_P = 0.2;
const RECEIPT_P = 0.15;
// Casual fans sometimes stop coming back; the core never does. Keeps the month total near 130k and the boards organic.
const LAPSE: Rates = { high: 0, medium: 0.35, low: 0.45 };
const CHAT_WEIGHT: Rates = { high: 5, medium: 2, low: 1 };

// "First L." like the Figma. Not Amanda, Adam, Claire or Perice: those are real people on this project.
const NAMES: Record<Level, string[]> = {
  high: ["Maya R.", "Jordan K.", "Theo M.", "Priya S.", "Marcus B.", "Elena V.", "Devin C.", "Sofia L.", "Nate H.", "Hannah W."],
  medium: [
    "Leo T.", "Grace P.", "Owen D.", "Isla F.", "Caleb J.", "Nina G.", "Ruby A.", "Felix O.", "Zoe N.", "Isaac Q.",
    "Tessa E.", "Miles U.", "Layla I.", "Jonah Y.", "Chloe Z.", "Rafael M.", "Harper S.", "Ezra B.", "Lucy K.", "Sam W.",
    "Aisha R.", "Kai D.", "Mira L.", "Tom H.", "Bea C.",
  ],
  low: [
    "Dylan F.", "Rosa J.", "Ben G.", "Ava T.", "Noor P.", "Luis E.", "Freya N.", "Oscar V.", "Ivy M.", "Jay S.",
    "Molly B.", "Arun K.", "Ellie D.", "Finn R.", "Nadia W.", "Cole A.", "Juno H.", "Max O.", "Wren L.", "Seb T.",
    "Lola G.", "Ryan Q.", "Amara C.", "Hugo P.", "Tara M.",
  ],
};
export const FANS: FillerFan[] = (["high", "medium", "low"] as Level[]).flatMap((level) => NAMES[level].map((name) => ({ name, level, email: "" })));
FANS.forEach((f, i) => {
  const [first, initial] = f.name.split(" ");
  f.email = `${first.toLowerCase()}.${initial[0].toLowerCase()}${i + 1}@${SEED_DOMAIN}`;
});

// ---------- deterministic randomness ----------
function hash32(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}
export type Rng = () => number;
/** mulberry32 seeded from a string: the same seed always yields the same sequence. */
export function rng(seed: string): Rng {
  let a = hash32(seed);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const between = (r: Rng, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
const pick = <T,>(r: Rng, xs: T[]) => xs[Math.floor(r() * xs.length)];
function shuffle<T>(r: Rng, xs: T[]) {
  const out = xs.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
/** A v4-shaped uuid from the rng, so per-item keys are reproducible too. */
export function uuid(r: Rng) {
  const hex = Array.from({ length: 32 }, () => Math.floor(r() * 16).toString(16));
  hex[12] = "4";
  hex[16] = (8 + Math.floor(r() * 4)).toString(16);
  const s = hex.join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

// ---------- time in the channel zone ----------
type Ymd = { y: number; m: number; d: number };
export function wallClock(tz: string, at: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(at);
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: n("year"), m: n("month"), d: n("day"), h: n("hour"), min: n("minute"), s: n("second") };
}
/** The instant that reads as the given wall-clock time in tz. */
export function zonedDate(tz: string, y: number, m: number, d: number, h = 0, min = 0, s = 0): Date {
  const wall = Date.UTC(y, m - 1, d, h, min, s);
  const offsetAt = (t: number) => {
    const w = wallClock(tz, new Date(t));
    return Date.UTC(w.y, w.m - 1, w.d, w.h, w.min, w.s) - t;
  };
  const once = wall - offsetAt(wall);
  return new Date(wall - offsetAt(once)); // the second pass settles DST edges
}
export function monthStart(tz: string, now: Date) {
  const w = wallClock(tz, now);
  return zonedDate(tz, w.y, w.m, 1);
}
function shiftDay({ y, m, d }: Ymd, days: number): Ymd {
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}
const minutesAfter = (r: Rng, at: Date, lo: number, hi: number) => new Date(at.getTime() + between(r, lo * 60, hi * 60) * 1000);

// ---------- XP history ----------
type Ctx = {
  tz: string; now: Date; today: Ymd & { h: number };
  daily: QuestInfo[]; dailyLinks: QuestInfo[]; once: QuestInfo[]; weekly: QuestInfo[]; receipts: QuestInfo[]; invites: QuestInfo[];
};
type Add = (who: string, q: QuestInfo, period: string, at: Date, xp?: number) => void;

/** Visit instants, oldest first: a random local hour 7..23 on each visit day from the join day on, never in the future. */
function visitDays(r: Rng, level: Level, ctx: Ctx, joinAgo: number, quietAgo: number): Date[] {
  const out: Date[] = [];
  for (let ago = joinAgo; ago >= quietAgo; ago--) {
    if (ago !== joinAgo && r() >= VISIT[level]) continue;
    if (ago === 0 && ctx.today.h < 8) continue;
    const day = shiftDay(ctx.today, -ago);
    out.push(zonedDate(ctx.tz, day.y, day.m, day.d, between(r, 7, ago === 0 ? ctx.today.h - 1 : 23), between(r, 0, 59), between(r, 0, 59)));
  }
  return out;
}

function fanAwards(fan: FillerFan, ctx: Ctx, add: Add) {
  const r = rng(fan.email);
  // The core joined in the first three weeks; the rest lean recent (a new band's crowd grows) but none in the last week,
  // so newcomers' one-time bursts do not own the weekly board. The join day always has a visit.
  const joinAgo = fan.level === "high" ? HISTORY_DAYS - 1 - Math.floor(r() * 20) : 8 + Math.floor(r() ** 1.5 * (HISTORY_DAYS - 8));
  const quietAgo = r() < LAPSE[fan.level] ? between(r, 2, joinAgo - 2) : 0;
  const visits = visitDays(r, fan.level, ctx, joinAgo, quietAgo);
  for (const at of visits) {
    for (const q of ctx.daily) add(fan.email, q, periodKey("daily", ctx.tz, at), at);
    if (r() < MERCH_LINK_P) for (const q of ctx.dailyLinks) {
      const t = minutesAfter(r, at, 1, 30);
      add(fan.email, q, periodKey("daily", ctx.tz, t), t);
    }
  }
  const weeks = new Map<string, Date[]>();
  for (const at of visits) {
    const k = periodKey("weekly", ctx.tz, at);
    weeks.set(k, [...(weeks.get(k) ?? []), at]);
  }
  for (const days of weeks.values()) for (const q of ctx.weekly) {
    if (r() >= (WEEKLY[q.title] ?? WEEKLY_DEFAULT)[fan.level]) continue;
    const t = minutesAfter(r, pick(r, days), 2, 90);
    add(fan.email, q, periodKey("weekly", ctx.tz, t), t);
  }
  for (const q of ctx.once) {
    if (r() >= ONCE[fan.level]) continue;
    const t = minutesAfter(r, visits[Math.floor(r() * Math.min(visits.length, 20))], 3, 120); // one-time quests get done over the first visits
    add(fan.email, q, "", t, q.type === "quiz" ? Math.round(q.xp * pick(r, [1, 0.75, 0.5, 0.25])) : q.xp);
  }
  if (fan.level !== "low" && r() < RECEIPT_P) for (const q of ctx.receipts) for (let n = between(r, 1, 2); n > 0; n--) {
    add(fan.email, q, uuid(r), minutesAfter(r, pick(r, visits), 5, 180));
  }
  return { r, visits };
}

/** The owner's rows: 20 visit days of the last 30 (always yesterday and today), every one-time quest, recent weeklies. */
function ownerAwards(ctx: Ctx, skip: Set<string>, add: Add) {
  const r = rng(ME);
  const addNew: Add = (who, q, period, at, xp) => {
    if (!skip.has(awardKey(q.title, period))) add(who, q, period, at, xp);
  };
  const agos = [0, 1, ...shuffle(r, Array.from({ length: 28 }, (_, i) => i + 2)).slice(0, 18)].sort((a, b) => b - a);
  const visits: Date[] = [];
  for (const ago of agos) {
    if (ago === 0 && ctx.today.h < 8) continue;
    const day = shiftDay(ctx.today, -ago);
    visits.push(zonedDate(ctx.tz, day.y, day.m, day.d, between(r, 7, ago === 0 ? ctx.today.h - 1 : 23), between(r, 0, 59), between(r, 0, 59)));
  }
  for (const at of visits) for (const q of ctx.daily) addNew(ME, q, periodKey("daily", ctx.tz, at), at);
  for (const q of ctx.once) addNew(ME, q, "", minutesAfter(r, pick(r, visits), 3, 120), q.xp);
  const weeksBack = (title: string) => (title === "Song of the week" ? 3 : title === "Tag us" ? 0 : 2);
  for (const q of ctx.weekly) for (let k = 0; k < weeksBack(q.title); k++) {
    const ref = new Date(ctx.now.getTime() - k * 7 * 86400000);
    const key = periodKey("weekly", ctx.tz, ref);
    const inWeek = visits.filter((v) => periodKey("weekly", ctx.tz, v) === key);
    const monday = weekStart(ctx.tz, ref);
    const base = inWeek.length ? pick(r, inWeek) : zonedDate(ctx.tz, monday.getUTCFullYear(), monday.getUTCMonth() + 1, monday.getUTCDate(), 20);
    const t = minutesAfter(r, base, 2, 90);
    addNew(ME, q, periodKey("weekly", ctx.tz, t), t);
  }
}

// ---------- chat ----------
// Threads in time order; each line is [slot, body]. Slots A-D are fans picked per thread, M is the owner.
// Never three lines by one slot in a row, and no thread opens with M.
type Line = [string, string];
const THREADS: Line[][] = [
  [
    ["A", "ok who else just found this site through the Her Shoes link"],
    ["B", "me, took the quiz first thing and got 3/4 🙃"],
    ["A", "which one did you miss"],
    ["B", "not saying, do it yourself"],
    ["C", "the quiz is 400 xp btw, worth it even if you miss one"],
  ],
  [
    ["A", "daily visit streak day 4. tiny number but it adds up"],
    ["B", "150 a day is basically a free quest"],
    ["A", "exactly. plus the merch store click is 50 more"],
    ["C", "wait the merch store visit pays daily?? brb"],
  ],
  [
    ["A", "voted in the setlist poll. Her Shoes has to open"],
    ["B", "disagree, Her Shoes closer. save it"],
    ["A", "opener. you want everyone screaming from minute one"],
    ["C", "or play it twice 🤷"],
    ["B", "^ this is the correct answer"],
  ],
  [
    ["A", "finally joined the Moths list, 100 xp for an email is wild"],
    ["B", "same, did it on day one"],
    ["M", "that one is a one-and-done so grab it early, same with the polls"],
    ["A", "yep grabbed it"],
  ],
  [
    ["A", "merch in the wild: wore the tee to the grocery store, took a selfie by the cereal, 300 xp"],
    ["B", "the cereal aisle is a venue now"],
    ["C", "mine was at the bus stop, quality photo, 0 likes from the people waiting"],
    ["A", "art is misunderstood"],
  ],
  [
    ["A", "song of the week vote is up for this week, go"],
    ["B", "voted Her Shoes again, sorry not sorry"],
    ["C", "voting Her Shoes until they give us something else to vote for 😅"],
    ["B", "the b side in my heart"],
    ["A", "250 xp for a click, the vote pays better than the merch link"],
  ],
  [
    ["A", "recreated the album cover with my cat. she was not into it"],
    ["B", "pics or it did not happen"],
    ["A", "it is in the uploads, 250 xp, the cat gets nothing"],
    ["C", "the cat should get a cut"],
    ["D", "cat union when"],
  ],
  [
    ["A", "leaderboard check: who is sitting at #1 monthly right now"],
    ["B", "not me, I am #7 and climbing"],
    ["C", "#2 here, two invites away from the top"],
    ["A", "invite friends is 1000 each?? ok that changes things"],
    ["B", "yeah but they have to actually do a quest first"],
  ],
  [
    ["A", "the playlist proof took me a minute, had to screenshot the right thing"],
    ["B", "what counts? I added Her Shoes to my running playlist"],
    ["A", "screenshot with the song in the list, then wait for the review"],
    ["B", "ok submitted 🤞"],
    ["C", "mine got approved overnight, 200 xp"],
  ],
  [
    ["A", "show request: play a house show in my town, I have a basement"],
    ["B", "I have a garage. slightly bigger basement"],
    ["C", "I have a backyard and a neighbour who hates noise. ideal"],
    ["A", "the tour poll exists for a reason, vote your city"],
  ],
  [
    ["A", "anyone else refresh the feed just to watch the xp roll in"],
    ["B", "the recent activity thing is dangerously satisfying"],
    ["M", "watching someone pass me in real time is a specific kind of pain"],
    ["A", "lol who passed you"],
    ["M", "not saying but they know who they are"],
  ],
  [
    ["A", "tagged the band in my story with the tee, 100 xp pending"],
    ["B", "the tag us one pays weekly right, so again next week"],
    ["A", "yes, I am going to be insufferable"],
    ["C", "already there"],
  ],
  [
    ["A", "quiz question 2 is a trap"],
    ["B", "it is not a trap you just did not listen to the song properly"],
    ["A", "I have listened to Her Shoes 40 times"],
    ["B", "41 then"],
    ["C", "41 is the magic number apparently"],
  ],
  [
    ["A", "what should we make next poll: I voted video, we need visuals"],
    ["B", "I went acoustic version. Her Shoes slowed down would end me"],
    ["C", "live session for me, the session take poll made me want it"],
    ["A", "all three. greedy"],
  ],
  [
    ["A", "how did I miss the daily visit yesterday, I was literally on the site"],
    ["B", "you have to load the page after midnight on their clock, not yours"],
    ["A", "midnight where"],
    ["B", "wherever the band sleeps"],
    ["C", "I set an alarm. no shame"],
  ],
  [
    ["A", "ok the merch store. I went in for the daily click and came out with a hoodie"],
    ["B", "the merch click is a trap and I respect it"],
    ["A", "receipt uploaded for the merch quest, 300 more if it clears"],
    ["C", "clears fast, mine took an hour"],
  ],
  [
    ["A", "listen to Her Shoes quest: did it, then listened 6 more times, no extra xp, rude"],
    ["B", "they should pay per listen"],
    ["C", "my wallet says no but my heart says yes"],
    ["D", "quest idea: 1 xp per listen, cap at bankruptcy"],
  ],
  [
    ["A", "is the song of the week thing one and done or what"],
    ["M", "fresh vote every week, 250 each time, it closes with the week so vote before monday"],
    ["A", "ok that is a lot of free xp I have been ignoring"],
    ["M", "most people miss it the first week"],
    ["B", "welcome to the grind"],
  ],
  [
    ["A", "my recreate the album cover attempt involves a lamp and regret"],
    ["B", "the lamp is doing a lot of work in all of these"],
    ["C", "I used a flashlight and my sister. she wants royalties"],
    ["A", "everyone's sister wants royalties"],
  ],
  [
    ["A", "weekly board reset and I am #1 for about four hours before the morning crowd"],
    ["B", "enjoy your reign"],
    ["C", "I am coming for it after work"],
    ["A", "bring xp"],
  ],
  [
    ["A", "has anyone's invite actually converted? mine just sits there"],
    ["B", "they need to do a quest that is not the daily visit"],
    ["A", "told them to do the quiz. they got 1/4"],
    ["C", "still counts 🤣"],
    ["B", "1/4 and 100 xp, honestly fine"],
  ],
  [
    ["A", "show request: anywhere with a train station, I will come"],
    ["B", "any festival. a parking lot. a laundromat"],
    ["C", "the laundromat set would go hard"],
    ["A", "Her Shoes in a laundromat is thematically correct"],
  ],
  [
    ["A", "just hit 10 daily visits in a row"],
    ["B", "respect. I missed sunday and I am still upset"],
    ["C", "sunday is the trap day"],
  ],
  [
    ["A", "the quiz let me retake it? no wait it did not. ignore me"],
    ["B", "one shot. choose wisely"],
    ["C", "I got 4/4 and I will be mentioning it in every conversation"],
    ["A", "we know"],
  ],
  [
    ["A", "top 3 monthly is all people with the merch receipt. coincidence"],
    ["B", "the hoodie is a leaderboard strategy"],
    ["C", "wearing it to the show as a flex"],
    ["M", "the receipt quest is per item so technically two hoodies is 600"],
    ["A", "do not give them ideas"],
  ],
  [
    ["A", "share Her Shoes quest done, posted the link, 100 xp"],
    ["B", "pending for me, the review queue must be busy"],
    ["C", "mine took a day, worth it"],
    ["B", "patience is also a quest apparently"],
  ],
  [
    ["A", "someone recreate the album cover with a dog, the cat version is winning"],
    ["B", "my dog refused. he has standards"],
    ["C", "my dog will do anything for cheese. uploading tonight"],
    ["A", "cheese based art"],
  ],
  [
    ["A", "new week, song of the week vote is open again"],
    ["B", "voted. Her Shoes. the usual"],
    ["C", "the usual 🫡"],
    ["D", "250 xp on a monday morning is the best way to start a week"],
  ],
  [
    ["A", "who jumped to #2 on the weekly board overnight"],
    ["M", "guilty, did the album cover thing and the share in one night"],
    ["A", "efficient"],
    ["B", "ok I need to do the cover one. what did you use"],
    ["M", "a lamp. always a lamp"],
  ],
  [
    ["A", "merch in the wild at the gym. the tee has now seen more cardio than me"],
    ["B", "the tee is the athlete"],
    ["C", "I wore mine to a wedding. 300 xp and a confused aunt"],
    ["A", "confused aunt is the target audience"],
  ],
  [
    ["A", "tour poll update: anyone else just voting for wherever has the most friends"],
    ["B", "I voted for my city and told my city"],
    ["C", "I tried to vote twice. it did not let me"],
    ["A", "one vote each, as it should be"],
  ],
  [
    ["A", "daily visit done, merch click done, now what"],
    ["B", "the setlist poll if you have not"],
    ["A", "did it week one"],
    ["C", "then you wait for the week to roll and do it all again 😌"],
  ],
  [
    ["A", "who is online rn, the fans online number just jumped"],
    ["B", "here, waiting on my playlist proof to clear"],
    ["C", "here, 3 away from passing someone on the lifetime board"],
    ["M", "here. refreshing like it is a sport"],
    ["A", "it is a sport"],
    ["B", "ok back to the quiz debate, question 2 is NOT a trap"],
  ],
];

/** Thread start instants in [from, to], at local hours 8..23, ascending and at least 45 minutes apart. */
function placeThreads(r: Rng, tz: string, count: number, from: number, to: number) {
  const starts: number[] = [];
  while (starts.length < count) {
    const t = from + r() * (to - from);
    if (wallClock(tz, new Date(t)).h >= 8) starts.push(t);
  }
  starts.sort((a, b) => a - b);
  for (let i = starts.length - 2; i >= 0; i--) starts[i] = Math.min(starts[i], starts[i + 1] - 45 * 60000);
  return starts;
}

function chatLines(ctx: Ctx, fans: FillerFan[]): PlannedChat[] {
  const r = rng("chat");
  const now = ctx.now.getTime();
  const recent = Math.round(THREADS.length * 0.4); // the last 48 hours carry 40% of the threads
  const gaps = THREADS.map((t) => t.slice(1).map(() => between(r, 15, 300) * 1000));
  const last = gaps[gaps.length - 1].reduce((a, b) => a + b, 0);
  const starts = [
    ...placeThreads(r, ctx.tz, THREADS.length - recent, now - CHAT_DAYS * 86400000 + 3600000, now - 48 * 3600000),
    ...placeThreads(r, ctx.tz, recent - 1, now - 48 * 3600000, now - 100 * 60000),
    now - between(r, 3, 12) * 60000 - last,
  ];
  const weights = fans.map((f) => CHAT_WEIGHT[f.level]);
  const total = weights.reduce((a, b) => a + b, 0);
  const pickFan = (taken: Set<string>): string => {
    for (;;) {
      let x = r() * total;
      const fan = fans.find((_, i) => (x -= weights[i]) < 0) ?? fans[fans.length - 1];
      if (!taken.has(fan.email)) return fan.email;
    }
  };
  const out: PlannedChat[] = [];
  THREADS.forEach((thread, ti) => {
    const slots = new Map<string, string>();
    let at = starts[ti];
    thread.forEach(([slot, body], li) => {
      if (li > 0) at += gaps[ti][li - 1];
      let who = slot === "M" ? ME : slots.get(slot);
      if (!who) {
        const taken = new Set(slots.values());
        const n = out.length;
        if (n >= 2 && out[n - 1].who === out[n - 2].who) taken.add(out[n - 1].who);
        who = pickFan(taken);
        slots.set(slot, who);
      }
      out.push({ who, body, at: new Date(at) });
    });
  });
  for (let i = 0; i < out.length; i++) {
    if (i > 0 && out[i].at <= out[i - 1].at) throw new Error(`chat line ${i} is out of order`);
    if (i >= 2 && out[i].who === out[i - 1].who && out[i].who === out[i - 2].who) throw new Error(`chat line ${i}: three in a row by ${out[i].who}`);
  }
  return out;
}

// ---------- the plan ----------
export function makePlan({ now, tz, quests = LIVE_QUESTS, skipMine = new Set<string>() }: PlanOptions): Plan {
  const w = wallClock(tz, now);
  const ctx: Ctx = {
    tz, now, today: { y: w.y, m: w.m, d: w.d, h: w.h },
    daily: quests.filter((q) => q.type === "daily_visit"),
    dailyLinks: quests.filter((q) => q.type === "visit_link" && q.repeat_rule === "daily"),
    once: quests.filter((q) => q.repeat_rule === "once"),
    weekly: quests.filter((q) => q.repeat_rule === "weekly"),
    receipts: quests.filter((q) => q.type === "receipt_proof" && q.repeat_rule === "per_item"),
    invites: quests.filter((q) => q.type === "invite"),
  };
  const awards: PlannedAward[] = [];
  const seen = new Set<string>();
  const clamp = rng("clamp");
  const add: Add = (who, q, period, at, xp = q.xp) => {
    const key = `${who}\u0000${awardKey(q.title, period)}`;
    if (seen.has(key) || xp <= 0) return; // the ledger's unique index would refuse a second (fan, quest, period) row
    seen.add(key);
    if (at > now) at = new Date(now.getTime() - between(clamp, 60, 600) * 1000); // follow-ups to today's visit stay in the past
    awards.push({ who, title: q.title, source: sourceFor(q), periodKey: period, xp, at });
  };
  const inviters = new Set(shuffle(rng("invites"), FANS.filter((f) => f.level === "medium")).slice(0, 4).map((f) => f.email));
  for (const fan of FANS) {
    const { r, visits } = fanAwards(fan, ctx, add);
    if (inviters.has(fan.email)) for (const q of ctx.invites) for (let n = between(r, 1, 2); n > 0; n--) {
      const settled = visits.filter((v) => v.getTime() < now.getTime() - 10 * 86400000); // invites converted a while ago, not on this week's board
      add(fan.email, q, uuid(r), minutesAfter(r, pick(r, settled.length ? settled : visits), 10, 600));
    }
  }
  ownerAwards(ctx, skipMine, add);
  const chat = chatLines(ctx, FANS);
  const first = new Map<string, number>();
  const lastSeen = new Map<string, number>();
  for (const a of awards) {
    first.set(a.who, Math.min(first.get(a.who) ?? Infinity, a.at.getTime()));
    lastSeen.set(a.who, Math.max(lastSeen.get(a.who) ?? 0, a.at.getTime()));
  }
  for (const c of chat) lastSeen.set(c.who, Math.max(lastSeen.get(c.who) ?? 0, c.at.getTime()));
  const fans = FANS.map((f) => {
    const r = rng(`${f.email}:created`);
    const start = first.get(f.email) ?? lastSeen.get(f.email) ?? now.getTime();
    return { ...f, createdAt: new Date(start - r() * 10 * 86400000), lastSeenAt: new Date(lastSeen.get(f.email) ?? start) };
  });
  return { fans, awards, chat };
}
