import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "../_lib";
import { saveReward } from "../actions";
import { PickWinner } from "./PickWinner";
import type { RewardStat } from "@/lib/data";

export const dynamic = "force-dynamic";

type RewardRow = { id: string; type: string; title: string; body: string | null; image_url: string | null; stock: number | null; delivery_type: string; delivery_payload: string | null; draw_ends_at: string | null; min_lifetime_xp: number; status: string; sort_order: number; picked_at: string | null };

function RewardForm({ slug, r }: { slug: string; r: RewardRow | null }) {
  return (
    <form action={saveReward.bind(null, slug, r?.id ?? null)} className="card space-y-3 p-4">
      <h3 className="display text-xl">{r ? "Edit" : "New reward"}</h3>
      <div className="grid grid-cols-2 gap-2">
        <select name="type" className="input" defaultValue={r?.type ?? "claim"}><option value="claim">claim offer</option><option value="draw">draw</option></select>
        <select name="status" className="input" defaultValue={r?.status ?? "live"}>{["draft", "live", "closed"].map((s) => <option key={s}>{s}</option>)}</select>
      </div>
      <input name="title" className="input" placeholder="Title" defaultValue={r?.title ?? ""} required maxLength={120} />
      <textarea name="body" className="input" placeholder="Description" defaultValue={r?.body ?? ""} maxLength={300} />
      <input name="image_url" className="input" placeholder="Image URL (optional)" defaultValue={r?.image_url ?? ""} />
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-muted">Stock (blank = unlimited)<input name="stock" type="number" min={0} className="input mt-1" defaultValue={r?.stock ?? ""} /></label>
        <label className="text-xs text-muted">Unlock at lifetime XP<input name="min_lifetime_xp" type="number" min={0} className="input mt-1" defaultValue={r?.min_lifetime_xp ?? 0} /></label>
        <label className="text-xs text-muted">Delivery<select name="delivery_type" className="input mt-1" defaultValue={r?.delivery_type ?? "text"}>{["text", "code", "link"].map((s) => <option key={s}>{s}</option>)}</select></label>
        <label className="text-xs text-muted">Draw closes (UTC)<input name="draw_ends_at" type="datetime-local" className="input mt-1" defaultValue={r?.draw_ends_at ? new Date(r.draw_ends_at).toISOString().slice(0, 16) : ""} /></label>
      </div>
      <textarea name="delivery_payload" className="input" placeholder="What the fan sees after claiming: text, a code, or a link" defaultValue={r?.delivery_payload ?? ""} maxLength={500} />
      <label className="flex items-center gap-2 text-sm">Order <input name="sort_order" type="number" className="input w-24" defaultValue={r?.sort_order ?? 100} /></label>
      <button type="submit" className="btn btn-primary w-full">Save</button>
    </form>
  );
}

export default async function RewardsAdmin({ params, searchParams }: { params: Promise<{ channel: string }>; searchParams: Promise<{ error?: string; saved?: string }> }) {
  const { channel: slug } = await params;
  const { error, saved } = await searchParams;
  const { channel } = await requireAdmin(slug);
  const sb = await createClient();
  const [{ data: rewards }, { data: stats }, { data: claims }] = await Promise.all([
    sb.rpc("admin_rewards", { p_channel: channel.id }),
    sb.rpc("reward_stats", { p_channel: channel.id }),
    sb.from("reward_claims").select("reward_id, created_at, fans(display_name, email)").order("created_at", { ascending: false }).limit(300),
  ]);
  const statFor = (id: string) => ((stats ?? []) as RewardStat[]).find((s) => s.reward_id === id);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {error === "image_host" && <p className="text-sm text-danger lg:col-span-2">Image URLs must point at our storage or this site.</p>}
      {saved && <p className="text-sm text-success lg:col-span-2">Saved.</p>}
      <div className="space-y-4">
        {(rewards ?? []).map((r) => {
          const s = statFor(r.id);
          const cl = (claims ?? []).filter((c) => c.reward_id === r.id);
          return (
            <div key={r.id} className="space-y-2">
              <RewardForm slug={slug} r={r} />
              <div className="card p-3 text-xs text-muted">
                {r.type === "claim" ? `${s?.claims ?? 0} claimed${r.stock != null ? ` of ${r.stock}` : ""}` : `${s?.entries ?? 0} entries${r.picked_at ? ` · winner: ${s?.winner_name ?? "picked"}` : ""}`}
                {r.type === "draw" && !r.picked_at && <PickWinner slug={slug} id={r.id} />}
                {cl.length > 0 && (
                  <details className="mt-2"><summary className="cursor-pointer">Claims</summary>
                    <ul className="mt-1 space-y-1">{cl.map((c, i) => <li key={i}>{(c.fans as { display_name: string | null; email: string } | null)?.display_name ?? "No name"} · {(c.fans as { email: string } | null)?.email} · {new Date(c.created_at).toLocaleDateString()}</li>)}</ul>
                  </details>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <RewardForm slug={slug} r={null} />
    </div>
  );
}
