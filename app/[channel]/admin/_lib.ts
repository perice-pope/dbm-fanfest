import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getChannel, getViewer, isAdminOf, type Channel, type Fan } from "@/lib/data";

/** Every admin page and action starts here. */
export async function requireAdmin(slug: string): Promise<{ channel: Channel; fan: Fan }> {
  const channel = await getChannel(slug);
  if (!channel) notFound();
  const { fan } = await getViewer();
  if (!fan) redirect(`/${slug}/sign-in?next=${encodeURIComponent(`/${slug}/admin`)}`);
  if (!(await isAdminOf(channel.id))) redirect(`/${slug}`);
  return { channel, fan };
}

export async function signedProofUrl(path: string | null) {
  if (!path) return null;
  const sb = await createClient();
  const { data } = await sb.storage.from("proofs").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export function str(fd: FormData, key: string) {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}
export function num(fd: FormData, key: string, fallback = 0) {
  const n = Number(str(fd, key));
  return Number.isFinite(n) ? n : fallback;
}
export function bool(fd: FormData, key: string) {
  return fd.get(key) === "on" || fd.get(key) === "true";
}
