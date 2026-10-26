/** Period keys mirror public.period_key_for in Postgres so cards can show state without a round trip. */
export type RepeatRule = "once" | "daily" | "weekly" | "monthly" | "per_item";

function localParts(date: Date, tz: string) {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
  const [y, m, d] = fmt.format(date).split("-").map(Number);
  return { y, m, d };
}

function isoWeek(y: number, m: number, d: number) {
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: date.getUTCFullYear(), week };
}

export function periodKey(rule: RepeatRule, tz: string, at: Date = new Date()): string {
  const { y, m, d } = localParts(at, tz);
  const pad = (n: number) => String(n).padStart(2, "0");
  switch (rule) {
    case "daily":
      return `${y}-${pad(m)}-${pad(d)}`;
    case "weekly": {
      const { year, week } = isoWeek(y, m, d);
      return `${year}-W${pad(week)}`;
    }
    case "monthly":
      return `${y}-${pad(m)}`;
    default:
      return "";
  }
}

/** Monday 00:00 in the channel time zone, as a UTC Date. */
export function weekStart(tz: string, at: Date = new Date()): Date {
  const { y, m, d } = localParts(at, tz);
  const probe = new Date(Date.UTC(y, m - 1, d));
  const dow = probe.getUTCDay() || 7;
  probe.setUTCDate(probe.getUTCDate() - (dow - 1));
  return probe;
}
