"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/errors";
import { requireAdmin, str, num, bool } from "./_lib";
import type { ActionResult } from "@/app/[channel]/actions";
import type { Json } from "@/lib/database.types";

/** Images may only come from our storage or our own site; anything else breaks next/image. */
function imageHostOk(url: string) {
  if (!url) return true;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    const own = process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL).hostname : "";
    return /\.supabase\.(co|in)$/.test(u.hostname) || u.hostname === "dbm-fanfest.vercel.app" || u.hostname === own;
  } catch {
    return false;
  }
}

function timezoneOk(tz: string) {
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; }
}

function back(slug: string, path = "") {
  revalidatePath(`/${slug}`);
  revalidatePath(`/${slug}/admin${path}`);
}

export async function approve(slug: string, id: string): Promise<ActionResult<{ awarded: boolean; xp: number; already?: boolean }>> {
  await requireAdmin(slug);
  try {
    const sb = await createClient();
    const { data, error } = await sb.rpc("approve_submission", { p_id: id });
    if (error) throw error;
    back(slug, "/review");
    return { ok: true, data: data as { awarded: boolean; xp: number; already?: boolean } };
  } catch (e) { return { ok: false, error: friendlyError(e) }; }
}

export async function reject(slug: string, id: string, reason: string, note: string, mode: "retry" | "final"): Promise<ActionResult<null>> {
  await requireAdmin(slug);
  try {
    const sb = await createClient();
    const { error } = await sb.rpc("reject_submission", { p_id: id, p_reason: reason, p_note: note, p_mode: mode });
    if (error) throw error;
    back(slug, "/review");
    return { ok: true, data: null };
  } catch (e) { return { ok: false, error: friendlyError(e) }; }
}

export async function moderate(slug: string, id: string, action: "feature" | "unfeature" | "hide" | "unhide" | "remove", reason?: string): Promise<ActionResult<null>> {
  await requireAdmin(slug);
  try {
    const sb = await createClient();
    const { error } = await sb.rpc("moderate_upload", { p_id: id, p_action: action, p_reason: reason ?? undefined });
    if (error) throw error;
    back(slug, "/uploads");
    return { ok: true, data: null };
  } catch (e) { return { ok: false, error: friendlyError(e) }; }
}

export async function saveQuest(slug: string, id: string | null, fd: FormData) {
  const { channel } = await requireAdmin(slug);
  const sb = await createClient();
  let config: Record<string, unknown> = {};
  try { config = JSON.parse(str(fd, "config") || "{}"); } catch { redirect(`/${slug}/admin/quests/${id ?? "new"}?error=config`); }
  const row = {
    channel_id: channel.id,
    type: str(fd, "type"),
    title: str(fd, "title"),
    description: str(fd, "description") || null,
    xp: Math.max(0, Math.round(num(fd, "xp"))),
    cta_label: str(fd, "cta_label") || null,
    link_url: str(fd, "link_url") || null,
    deadline: str(fd, "deadline") ? new Date(str(fd, "deadline")).toISOString() : null,
    repeat_rule: str(fd, "repeat_rule") || "once",
    lock_min_xp: Math.max(0, Math.round(num(fd, "lock_min_xp"))),
    status: str(fd, "status") || "live",
    sort_order: Math.round(num(fd, "sort_order")),
    config: config as Json,
  };
  const answerText = str(fd, "quiz_answers");
  const answers = answerText ? answerText.split(/[,\s]+/).filter(Boolean).map(Number) : [];
  if (row.type === "quiz") {
    const qs = Array.isArray((config as { questions?: unknown }).questions) ? ((config as { questions: { options?: unknown[] }[] }).questions) : [];
    const keyed = answers.length === qs.length && answers.every((a, i) => Number.isInteger(a) && a >= 0 && a < (qs[i]?.options?.length ?? 0));
    if (!keyed || (row.status === "live" && qs.length === 0)) redirect(`/${slug}/admin/quests/${id ?? "new"}?error=quiz`);
  }
  let questId = id;
  if (id) {
    const { error } = await sb.from("quests").update(row).eq("id", id).eq("channel_id", channel.id);
    if (error) redirect(`/${slug}/admin/quests/${id}?error=${encodeURIComponent(error.message)}`);
  } else {
    const { data, error } = await sb.from("quests").insert(row).select("id").single();
    if (error || !data) redirect(`/${slug}/admin/quests/new?error=${encodeURIComponent(error?.message ?? "insert")}`);
    questId = data.id;
  }
  if (row.type === "quiz") await sb.rpc("set_quiz_answers", { p_quest: questId!, p_answers: answers });
  back(slug, "/quests");
  revalidatePath(`/${slug}/q/${questId}`);
  redirect(`/${slug}/admin/quests?saved=1`);
}

export async function setQuestStatus(slug: string, id: string, status: "live" | "draft" | "archived") {
  const { channel } = await requireAdmin(slug);
  const sb = await createClient();
  await sb.from("quests").update({ status }).eq("id", id).eq("channel_id", channel.id);
  back(slug, "/quests");
}

export async function moveQuest(slug: string, id: string, dir: -1 | 1) {
  const { channel } = await requireAdmin(slug);
  const sb = await createClient();
  const { data: all } = await sb.from("quests").select("id, sort_order").eq("channel_id", channel.id).neq("status", "archived").order("sort_order");
  if (!all) return;
  const i = all.findIndex((q) => q.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= all.length) return;
  const a = all[i], b = all[j];
  const ao = a.sort_order === b.sort_order ? b.sort_order + dir : b.sort_order;
  await Promise.all([
    sb.from("quests").update({ sort_order: ao }).eq("id", a.id),
    sb.from("quests").update({ sort_order: a.sort_order }).eq("id", b.id),
  ]);
  back(slug, "/quests");
}

export async function saveNews(slug: string, id: string | null, fd: FormData) {
  const { channel } = await requireAdmin(slug);
  const sb = await createClient();
  if (!imageHostOk(str(fd, "image_url"))) redirect(`/${slug}/admin/news?error=image_host`);
  const row = {
    channel_id: channel.id, title: str(fd, "title"), body: str(fd, "body") || null, image_url: str(fd, "image_url") || null,
    link_url: str(fd, "link_url") || null, link_label: str(fd, "link_label") || null, sort_order: Math.round(num(fd, "sort_order")), is_active: bool(fd, "is_active"),
  };
  if (id) await sb.from("news_items").update(row).eq("id", id).eq("channel_id", channel.id);
  else await sb.from("news_items").insert(row);
  back(slug, "/news");
  redirect(`/${slug}/admin/news?saved=1`);
}

export async function deleteNews(slug: string, id: string) {
  const { channel } = await requireAdmin(slug);
  const sb = await createClient();
  await sb.from("news_items").delete().eq("id", id).eq("channel_id", channel.id);
  back(slug, "/news");
}

export async function saveReward(slug: string, id: string | null, fd: FormData) {
  const { channel } = await requireAdmin(slug);
  const sb = await createClient();
  const stock = str(fd, "stock");
  if (!imageHostOk(str(fd, "image_url"))) redirect(`/${slug}/admin/rewards?error=image_host`);
  const row = {
    channel_id: channel.id, type: str(fd, "type") as "claim" | "draw", title: str(fd, "title"), body: str(fd, "body") || null, image_url: str(fd, "image_url") || null,
    stock: stock === "" ? null : Math.max(0, Math.round(Number(stock))), delivery_type: (str(fd, "delivery_type") || "text") as "text" | "code" | "link", delivery_payload: str(fd, "delivery_payload") || null,
    draw_ends_at: str(fd, "draw_ends_at") ? new Date(str(fd, "draw_ends_at")).toISOString() : null, min_lifetime_xp: Math.max(0, Math.round(num(fd, "min_lifetime_xp"))),
    status: (str(fd, "status") || "live") as "draft" | "live" | "closed", sort_order: Math.round(num(fd, "sort_order")),
  };
  if (id) await sb.from("rewards").update(row).eq("id", id).eq("channel_id", channel.id);
  else await sb.from("rewards").insert(row);
  back(slug, "/rewards");
  redirect(`/${slug}/admin/rewards?saved=1`);
}

export async function pickWinner(slug: string, id: string): Promise<ActionResult<null>> {
  await requireAdmin(slug);
  try {
    const sb = await createClient();
    const { error } = await sb.rpc("pick_winner", { p_reward: id });
    if (error) throw error;
    back(slug, "/rewards");
    return { ok: true, data: null };
  } catch (e) { return { ok: false, error: friendlyError(e) }; }
}

export async function adjustXp(slug: string, fanId: string, fd: FormData) {
  const { channel } = await requireAdmin(slug);
  const sb = await createClient();
  const xp = Math.round(num(fd, "xp"));
  const reason = str(fd, "reason");
  if (xp !== 0 && reason) await sb.rpc("adjust_xp", { p_channel: channel.id, p_fan: fanId, p_xp: xp, p_reason: reason });
  back(slug, `/fans/${fanId}`);
}

export async function setFanStatus(slug: string, fanId: string, status: "active" | "hidden" | "banned") {
  const { channel } = await requireAdmin(slug);
  const sb = await createClient();
  await sb.rpc("set_fan_status", { p_channel: channel.id, p_fan: fanId, p_status: status });
  back(slug, `/fans/${fanId}`);
}

export async function saveSettings(slug: string, fd: FormData) {
  const { channel } = await requireAdmin(slug);
  const sb = await createClient();
  if (!timezoneOk(str(fd, "timezone") || channel.timezone)) redirect(`/${slug}/admin/settings?error=timezone`);
  const settings = { ...(channel.settings as Record<string, unknown>) };
  settings.merch_store_name = str(fd, "merch_store_name") || null;
  settings.review_cadence = str(fd, "review_cadence") || null;
  settings.submissions_per_day = Math.max(1, Math.round(num(fd, "submissions_per_day", 10)));
  settings.max_pending = Math.max(1, Math.round(num(fd, "max_pending", 5)));
  settings.chat_url = str(fd, "chat_url") || null;
  settings.theme = { ...((settings.theme as Record<string, string>) ?? {}), accent: str(fd, "accent") || "#f2b441" };
  const links = { spotify: str(fd, "link_spotify") || null, apple: str(fd, "link_apple") || null, instagram: str(fd, "link_instagram") || null, tiktok: str(fd, "link_tiktok") || null, facebook: str(fd, "link_facebook") || null, youtube: str(fd, "link_youtube") || null, merch: str(fd, "link_merch") || null };
  await sb.from("channels").update({ name: str(fd, "name") || channel.name, tagline: str(fd, "tagline") || null, timezone: str(fd, "timezone") || channel.timezone, settings: settings as Json, links }).eq("id", channel.id);
  back(slug, "/settings");
  redirect(`/${slug}/admin/settings?saved=1`);
}
