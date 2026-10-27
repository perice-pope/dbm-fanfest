/** "Ends Mar 30, 07:11AM" exactly as the Figma writes it. */
export function fmtEnds(iso: string, tz: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: true }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `Ends ${get("month")} ${get("day")}, ${get("hour")}:${get("minute")}${get("dayPeriod").toUpperCase()}`;
}

/** "+ 150 XP" with the Figma's spacing. */
export function fmtPlusXp(n: number) {
  return `+ ${new Intl.NumberFormat("en-US").format(n)} XP`;
}
