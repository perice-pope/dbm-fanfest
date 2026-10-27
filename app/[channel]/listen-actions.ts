"use server";
import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/errors";
import { syncFan, validateToken, type SyncResult } from "@/lib/listenbrainz";
import type { ActionResult } from "@/app/[channel]/actions";

/** The signed-in fan, the listening quest, and whether a draft may be used (channel admins test drafts before launch). */
async function context(slug: string, questId: string) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("SIGN_IN_REQUIRED");
  const { data: ch } = await sb.from("channels").select("id").eq("slug", slug).maybeSingle();
  if (!ch) throw new Error("NO_CHANNEL");
  const { data: admin } = await sb.rpc("is_admin", { p_channel: ch.id });
  const { data: q } = await createAdminClient().from("quests").select("id, status, type").eq("id", questId).eq("channel_id", ch.id).maybeSingle();
  const allowDraft = admin === true;
  if (!q || q.type !== "listen" || !(q.status === "live" || (allowDraft && q.status === "draft"))) throw new Error("QUEST_UNAVAILABLE");
  return { fanId: user.id, allowDraft };
}

export async function connectListenBrainz(slug: string, questId: string, token: string): Promise<ActionResult<{ username: string }>> {
  try {
    const { fanId } = await context(slug, questId);
    const username = await validateToken(token);
    const sb = createAdminClient();
    const { data: fan } = await sb.from("fans").select("status").eq("id", fanId).single();
    if (fan?.status === "banned") throw new Error("BANNED");
    const { data: existing } = await sb.from("listen_accounts").select("username").eq("fan_id", fanId).maybeSingle();
    // Relinking the same account keeps its start time; a different account starts counting from now.
    if (existing && existing.username.toLowerCase() === username.toLowerCase()) return { ok: true, data: { username: existing.username } };
    const row = { fan_id: fanId, service: "listenbrainz", username, connected_at: new Date().toISOString(), cursor_ts: 0, last_synced_at: null };
    const { error } = await sb.from("listen_accounts").upsert(row, { onConflict: "fan_id" });
    if (error) throw new Error(error.code === "23505" ? "LB_TAKEN" : error.message);
    revalidatePath(`/${slug}/q/${questId}`);
    return { ok: true, data: { username } };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

export async function syncListens(slug: string, questId: string): Promise<ActionResult<SyncResult>> {
  try {
    const { fanId, allowDraft } = await context(slug, questId);
    const { data: acc } = await createAdminClient().from("listen_accounts").select("last_synced_at").eq("fan_id", fanId).maybeSingle();
    if (!acc) throw new Error("NOT_CONNECTED");
    if (acc.last_synced_at && Date.now() - new Date(acc.last_synced_at).getTime() < 60_000) throw new Error("SYNC_TOO_SOON");
    const r = await syncFan(fanId, questId, { allowDraft });
    if (r.awarded) revalidatePath(`/${slug}`);
    revalidatePath(`/${slug}/q/${questId}`);
    return { ok: true, data: r };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

export async function disconnectListenBrainz(slug: string, questId: string): Promise<ActionResult<null>> {
  try {
    const { fanId } = await context(slug, questId);
    await createAdminClient().from("listen_accounts").delete().eq("fan_id", fanId);
    revalidatePath(`/${slug}/q/${questId}`);
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

