export function fmtXp(n: number | string | null | undefined) {
  const v = typeof n === "string" ? Number(n) : n ?? 0;
  return new Intl.NumberFormat("en-US").format(v);
}

export function timeAgo(iso: string, now: Date = new Date()) {
  const s = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w`;
  const mo = Math.floor(d / 30);
  return `${mo}mo`;
}

export function fmtDeadline(iso: string, tz: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

export function timeLeft(iso: string, now: Date = new Date()) {
  const ms = new Date(iso).getTime() - now.getTime();
  if (ms <= 0) return "ended";
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  if (d > 0) return `${d}d ${h}h left`;
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m left`;
}
