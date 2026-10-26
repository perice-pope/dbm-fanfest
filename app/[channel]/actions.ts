"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/errors";
import { normalizeSocialLink } from "@/lib/links";
import { requestOrigin } from "@/lib/site";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function channelId(sb: Awaited<ReturnType<typeof createClient>>, slug: string) {
  const { data } = await sb.from("channels").select("id").eq("slug", slug).maybeSingle();
  if (!data) throw new Error("NO_CHANNEL");
  return data.id;
}

export async function checkIn(slug: string): Promise<ActionResult<{ awarded: boolean; xp: number }>> {
  try {
    const sb = await createClient();
    const { data, error } = await sb.rpc("check_in", { p_channel_slug: slug });
    if (error) throw error;
    const d = data as { awarded: boolean; xp: number };
    if (d.awarded) revalidatePath(`/${slug}`);
    return { ok: true, data: d };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

export async function claimReward(slug: string, rewardId: string): Promise<ActionResult<{ delivery_type: string; delivery_payload: string | null; left: number | null }>> {
  try {
    const sb = await createClient();
    const { data, error } = await sb.rpc("claim_reward", { p_reward: rewardId });
    if (error) throw error;
    revalidatePath(`/${slug}`);
    return { ok: true, data: data as { delivery_type: string; delivery_payload: string | null; left: number | null } };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

export async function enterDraw(slug: string, rewardId: string): Promise<ActionResult<{ entries: number }>> {
  try {
    const sb = await createClient();
    const { data, error } = await sb.rpc("enter_draw", { p_reward: rewardId });
    if (error) throw error;
    revalidatePath(`/${slug}`);
    return { ok: true, data: data as { entries: number } };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

export async function submitResponse(slug: string, questId: string, answers: (number | null)[]): Promise<ActionResult<{ awarded: boolean; xp: number; score: number; total: number; correct: number[] | null }>> {
  try {
    const parsed = z.array(z.number().int().min(0).max(50).nullable()).max(20).parse(answers);
    const sb = await createClient();
    const { data, error } = await sb.rpc("submit_response", { p_quest: questId, p_answers: parsed });
    if (error) throw error;
    revalidatePath(`/${slug}`);
    revalidatePath(`/${slug}/q/${questId}`);
    return { ok: true, data: data as { awarded: boolean; xp: number; score: number; total: number; correct: number[] | null } };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

const SubmissionInput = z.object({
  kind: z.enum(["image", "link"]),
  imagePath: z.string().max(300).optional(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  linkUrl: z.string().max(2048).optional(),
  handle: z.string().max(60).optional(),
  orderNumber: z.string().max(60).optional(),
  caption: z.string().max(200).optional(),
  consentFeatured: z.boolean().optional(),
  consentRights: z.boolean().optional(),
});

export async function createSubmission(slug: string, questId: string, input: z.input<typeof SubmissionInput>): Promise<ActionResult<{ id: string; status: string; awarded: boolean; xp: number }>> {
  try {
    const v = SubmissionInput.parse(input);
    let linkNormalized: string | undefined;
    if (v.kind === "link") {
      const check = normalizeSocialLink(v.linkUrl ?? "");
      if (!check.ok) return { ok: false, error: check.reason === "host" ? "Only Instagram, TikTok and Facebook links count." : "Paste a full https link to your post." };
      linkNormalized = check.normalized;
      v.linkUrl = check.original;
    } else if (!v.imagePath) {
      return { ok: false, error: "Upload a photo first." };
    }
    const sb = await createClient();
    const { data, error } = await sb.rpc("create_submission", {
      p_quest: questId, p_kind: v.kind, p_image_path: v.imagePath ?? undefined, p_sha256: v.sha256 ?? undefined, p_link_url: v.linkUrl ?? undefined, p_link_normalized: linkNormalized ?? undefined,
      p_handle: v.handle ?? undefined, p_order_number: v.orderNumber ?? undefined, p_caption: v.caption ?? undefined, p_consent_featured: v.consentFeatured ?? false, p_consent_rights: v.consentRights ?? false,
    });
    if (error) throw error;
    revalidatePath(`/${slug}`);
    revalidatePath(`/${slug}/q/${questId}`);
    return { ok: true, data: data as { id: string; status: string; awarded: boolean; xp: number } };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

export async function joinEmailList(slug: string): Promise<ActionResult<{ joined: boolean; awarded: boolean; xp: number }>> {
  try {
    const sb = await createClient();
    const id = await channelId(sb, slug);
    const { data, error } = await sb.rpc("join_email_list", { p_channel: id });
    if (error) throw error;
    revalidatePath(`/${slug}`);
    return { ok: true, data: data as { joined: boolean; awarded: boolean; xp: number } };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

const Profile = z.object({
  display_name: z.string().trim().min(2, "Pick a name of 2 to 24 characters.").max(24, "Pick a name of 2 to 24 characters."),
  instagram: z.string().trim().max(60).optional(),
  tiktok: z.string().trim().max(60).optional(),
  show_on_leaderboard: z.boolean(),
  show_activity: z.boolean(),
  newsletter_opt_in: z.boolean(),
});

export async function updateProfile(slug: string, formData: FormData): Promise<ActionResult<null>> {
  try {
    const v = Profile.parse({
      display_name: formData.get("display_name"),
      instagram: formData.get("instagram") ?? "",
      tiktok: formData.get("tiktok") ?? "",
      show_on_leaderboard: formData.get("show_on_leaderboard") === "on",
      show_activity: formData.get("show_activity") === "on",
      newsletter_opt_in: formData.get("newsletter_opt_in") === "on",
    });
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return { ok: false, error: "Sign in first." };
    const handles = { instagram: v.instagram?.replace(/^@/, "") || null, tiktok: v.tiktok?.replace(/^@/, "") || null };
    const { error } = await sb.from("fans").update({ display_name: v.display_name, handles, show_on_leaderboard: v.show_on_leaderboard, show_activity: v.show_activity, newsletter_opt_in: v.newsletter_opt_in }).eq("id", user.id);
    if (error) throw error;
    revalidatePath(`/${slug}`);
    revalidatePath(`/${slug}/account`);
    return { ok: true, data: null };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Check the form." };
    return { ok: false, error: friendlyError(e) };
  }
}

async function siteUrl() {
  return requestOrigin();
}

function safeNext(slug: string, next: string | null | undefined) {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return `/${slug}`;
}

export async function sendCode(slug: string, email: string, next?: string): Promise<ActionResult<null>> {
  try {
    const parsed = z.string().trim().email("Enter a valid email.").parse(email);
    const sb = await createClient();
    const base = await siteUrl();
    const { error } = await sb.auth.signInWithOtp({
      email: parsed,
      options: { shouldCreateUser: true, emailRedirectTo: `${base}/auth/confirm?next=${encodeURIComponent(safeNext(slug, next))}` },
    });
    if (error) throw error;
    return { ok: true, data: null };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Enter a valid email." };
    const msg = (e as { message?: string })?.message ?? "";
    if (/rate limit/i.test(msg)) return { ok: false, error: "Too many codes requested. Wait a minute and try again." };
    return { ok: false, error: "We could not send the code. Check the address and try again." };
  }
}

export async function verifyCode(slug: string, email: string, token: string, next?: string): Promise<ActionResult<{ next: string; needsName: boolean }>> {
  try {
    const sb = await createClient();
    const { error } = await sb.auth.verifyOtp({ email: email.trim(), token: token.trim(), type: "email" });
    if (error) return { ok: false, error: "That code did not work. Check it or request a new one." };
    await afterSignIn(slug);
    const { data: { user } } = await sb.auth.getUser();
    const { data: fan } = await sb.from("fans").select("display_name").eq("id", user!.id).maybeSingle();
    const needsName = !fan?.display_name;
    const dest = safeNext(slug, next);
    return { ok: true, data: { next: needsName ? `/${slug}/account?first=1&next=${encodeURIComponent(dest)}` : dest, needsName } };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

/** Attaches a referral cookie to a brand-new account. Safe to call on every sign-in. */
export async function afterSignIn(slug: string) {
  const store = await cookies();
  const ref = store.get("ff_ref")?.value;
  if (!ref) return;
  const sb = await createClient();
  const id = await channelId(sb, slug);
  await sb.rpc("attach_invite", { p_channel: id, p_code: ref });
  store.delete("ff_ref");
}

export async function signOut(slug: string) {
  const sb = await createClient();
  await sb.auth.signOut();
  redirect(`/${slug}`);
}
