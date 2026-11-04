import { headers } from "next/headers";

/** Origin for links we put in emails and share sheets: the configured site URL in production, else the request's host. */
export async function requestOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  if (configured && !host.startsWith("localhost") && !host.startsWith("127.")) return configured;
  return `${proto}://${host}`;
}

/** Where the fan club lives: FanFest's channel for the band. The beta URL until the band's domain is confirmed, then `https://fanfest.<banddomain>`. */
export const DEFAULT_FANFEST_URL = "https://beta.fanfest.vip/destroyedbymoths";
export function fanfestUrl() {
  return (process.env.NEXT_PUBLIC_FANFEST_URL || DEFAULT_FANFEST_URL).replace(/\/$/, "");
}

/** The merch store (Shopify or other). Unset means the Merch page shows a placeholder. */
export function merchUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_MERCH_URL?.trim();
  return url ? url : null;
}
