/**
 * Tour dates for the Shows page. Placeholder entries until the band sends real dates; replace them here
 * (or move them to a Supabase table once the band wants to edit them from the admin area).
 * `date` is the local calendar date at the venue, YYYY-MM-DD.
 */
export type Show = {
  id: string;
  date: string;
  city: string;
  venue: string;
  ticketUrl?: string | null;
  status: "on_sale" | "sold_out" | "announced";
  placeholder?: boolean;
};

export const SHOWS: Show[] = [
  { id: "2026-12-05-la", date: "2026-12-05", city: "Los Angeles, CA", venue: "The Echo", ticketUrl: null, status: "on_sale", placeholder: true },
  { id: "2027-01-16-sd", date: "2027-01-16", city: "San Diego, CA", venue: "Soda Bar", ticketUrl: null, status: "announced", placeholder: true },
  { id: "2027-02-20-sf", date: "2027-02-20", city: "San Francisco, CA", venue: "Bottom of the Hill", ticketUrl: null, status: "announced", placeholder: true },
  { id: "2026-09-12-la", date: "2026-09-12", city: "Los Angeles, CA", venue: "The Smell", ticketUrl: null, status: "sold_out", placeholder: true },
];

/** YYYY-MM-DD of today in the channel's timezone, so a show stays "upcoming" until the day is over where it happens. */
export function todayKey(tz: string, now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function splitShows(shows: Show[], today: string) {
  const sorted = [...shows].sort((a, b) => a.date.localeCompare(b.date));
  return { upcoming: sorted.filter((s) => s.date >= today), past: sorted.filter((s) => s.date < today).reverse() };
}

/** "SAT 5 DEC 2026", formatted from the calendar date alone (no timezone shift). */
export function formatShowDate(date: string) {
  const d = new Date(`${date}T12:00:00Z`);
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short", year: "numeric" }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("weekday")} ${get("day")} ${get("month")} ${get("year")}`.toUpperCase();
}

export const STATUS_LABEL: Record<Show["status"], string> = { on_sale: "On sale", sold_out: "Sold out", announced: "Announced" };
