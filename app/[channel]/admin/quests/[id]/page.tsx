import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "../../_lib";
import { saveQuest } from "../../actions";

export const dynamic = "force-dynamic";
const TYPES = ["daily_visit", "visit_link", "invite", "quiz", "poll", "weekly_vote", "photo_proof", "receipt_proof", "social_link", "social_screenshot", "email_signup"];
const RULES = ["once", "daily", "weekly", "monthly", "per_item"];

export default async function QuestEdit({ params, searchParams }: { params: Promise<{ channel: string; id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { channel: slug, id } = await params;
  const { error } = await searchParams;
  const { channel } = await requireAdmin(slug);
  const sb = await createClient();
  const isNew = id === "new";
  const { data: q } = isNew ? { data: null } : await sb.from("quests").select("*").eq("id", id).eq("channel_id", channel.id).maybeSingle();
  if (!isNew && !q) notFound();
  const { data: answers } = isNew ? { data: [] } : await sb.from("quiz_answers").select("question_index, correct_index").eq("quest_id", id).order("question_index");
  const answerStr = (answers ?? []).map((a) => a.correct_index).join(",");
  const toLocal = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 16) : "");
  return (
    <form action={saveQuest.bind(null, slug, isNew ? null : id)} className="card space-y-4 p-5">
      <h3 className="display text-2xl">{isNew ? "New quest" : "Edit quest"}</h3>
      {error && <p className="text-sm text-danger">{error === "config" ? "Config must be valid JSON." : error === "quiz" ? "A quiz needs one correct-answer index per question (each within that question's options), and cannot go live without them. Nothing was saved." : error}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Type<select name="type" className="input mt-1" defaultValue={q?.type ?? "poll"}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
        <label className="text-sm">Status<select name="status" className="input mt-1" defaultValue={q?.status ?? "live"}>{["draft", "live", "archived"].map((t) => <option key={t}>{t}</option>)}</select></label>
        <label className="text-sm sm:col-span-2">Title<input name="title" className="input mt-1" defaultValue={q?.title ?? ""} required maxLength={120} /></label>
        <label className="text-sm sm:col-span-2">Description<textarea name="description" className="input mt-1" defaultValue={q?.description ?? ""} maxLength={300} /></label>
        <label className="text-sm">XP<input name="xp" type="number" min={0} max={100000} className="input mt-1" defaultValue={q?.xp ?? 100} /></label>
        <label className="text-sm">CTA label<input name="cta_label" className="input mt-1" defaultValue={q?.cta_label ?? ""} maxLength={40} /></label>
        <label className="text-sm">Repeat rule<select name="repeat_rule" className="input mt-1" defaultValue={q?.repeat_rule ?? "once"}>{RULES.map((t) => <option key={t}>{t}</option>)}</select></label>
        <label className="text-sm">Unlock at lifetime XP<input name="lock_min_xp" type="number" min={0} className="input mt-1" defaultValue={q?.lock_min_xp ?? 0} /></label>
        <label className="text-sm sm:col-span-2">Link URL (visit link)<input name="link_url" className="input mt-1" defaultValue={q?.link_url ?? ""} /></label>
        <label className="text-sm">Deadline (UTC)<input name="deadline" type="datetime-local" className="input mt-1" defaultValue={toLocal(q?.deadline ?? null)} /></label>
        <label className="text-sm">Sort order<input name="sort_order" type="number" className="input mt-1" defaultValue={q?.sort_order ?? 100} /></label>
        <label className="text-sm sm:col-span-2">Config (JSON: questions, auto_approve, kind, hint, rights, consent, cap, variant)
          <textarea name="config" className="input mt-1 font-mono text-xs" rows={10} defaultValue={JSON.stringify(q?.config ?? {}, null, 2)} />
        </label>
        <label className="text-sm sm:col-span-2">Quiz answers (correct option index per question, comma separated; 0 = first option)<input name="quiz_answers" className="input mt-1" defaultValue={answerStr} placeholder="0,1,0,0,0" /></label>
      </div>
      <button type="submit" className="btn btn-primary w-full">Save</button>
    </form>
  );
}
