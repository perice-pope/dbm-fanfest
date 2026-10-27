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
