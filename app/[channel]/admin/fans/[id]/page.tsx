import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "../../_lib";
import { adjustXp, setFanStatus } from "../../actions";
import { fmtXp } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function FanDetail({ params }: { params: Promise<{ channel: string; id: string }> }) {
  const { channel: slug, id } = await params;
  const { channel } = await requireAdmin(slug);
  const sb = await createClient();
  const [{ data: fan }, { data: ledger }, { data: subs }, { data: total }, { data: invites }] = await Promise.all([
    sb.from("fans").select("*").eq("id", id).maybeSingle(),
    sb.from("xp_ledger").select("*").eq("channel_id", channel.id).eq("fan_id", id).order("created_at", { ascending: false }).limit(200),
    sb.from("submissions").select("id, status, created_at, reject_reason, quests(title)").eq("channel_id", channel.id).eq("fan_id", id).order("created_at", { ascending: false }).limit(100),
    sb.rpc("fan_total_xp", { p_channel: channel.id, p_fan: id }),
    sb.from("invites").select("invitee_fan_id, converted_at, flagged").eq("channel_id", channel.id).eq("inviter_fan_id", id),
  ]);
  if (!fan) notFound();
  return (
    <div className="space-y-4">
      <div className="card p-4">
        <h3 className="display text-2xl">{fan.display_name ?? "No name"}</h3>
        <p className="text-sm text-muted">{fan.email} · joined {new Date(fan.created_at).toLocaleDateString()} · lifetime {fmtXp(total ?? 0)} XP · {fan.status}</p>
        <p className="text-xs text-muted">Referral code {fan.referral_code} · {(invites ?? []).length} invited, {(invites ?? []).filter((i) => i.converted_at).length} converted{(invites ?? []).some((i) => i.flagged) ? " · flagged sign-ups" : ""}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["active", "hidden", "banned"] as const).map((s) => (
            <form key={s} action={setFanStatus.bind(null, slug, id, s)}><button className={`label ${fan.status === s ? "border-accent text-text" : ""}`}>{s}</button></form>
          ))}
        </div>
      </div>
      <form action={adjustXp.bind(null, slug, id)} className="card flex flex-wrap items-end gap-2 p-4">
        <label className="text-xs text-muted">Adjust XP (+/-)<input name="xp" type="number" className="input mt-1 w-32" required /></label>
        <label className="flex-1 text-xs text-muted">Reason (required)<input name="reason" className="input mt-1" required maxLength={120} /></label>
        <button className="btn btn-secondary">Apply</button>
      </form>
      <div className="card p-4">
        <h4 className="display text-xl">Ledger</h4>
        <ul className="mt-2 divide-y divide-line text-sm">
          {(ledger ?? []).map((l) => <li key={l.id} className="flex gap-3 py-1.5"><span className="w-24 text-muted">{new Date(l.created_at).toLocaleDateString()}</span><span className="flex-1 truncate">{l.note ?? l.source}</span><span className={l.xp < 0 ? "text-danger" : ""}>{l.xp > 0 ? "+" : ""}{fmtXp(l.xp)}</span></li>)}
          {(ledger ?? []).length === 0 && <li className="py-2 text-muted">No XP yet.</li>}
        </ul>
      </div>
      <div className="card p-4">
        <h4 className="display text-xl">Submissions</h4>
        <ul className="mt-2 divide-y divide-line text-sm">
          {(subs ?? []).map((s) => <li key={s.id} className="flex gap-3 py-1.5"><span className="w-24 text-muted">{new Date(s.created_at).toLocaleDateString()}</span><span className="flex-1 truncate">{(s.quests as { title: string } | null)?.title}</span><span className="text-muted">{s.status}{s.reject_reason ? ` · ${s.reject_reason}` : ""}</span></li>)}
          {(subs ?? []).length === 0 && <li className="py-2 text-muted">None.</li>}
        </ul>
      </div>
    </div>
  );
}
