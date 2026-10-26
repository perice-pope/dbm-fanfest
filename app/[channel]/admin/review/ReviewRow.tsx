"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approve, reject } from "../actions";
import { useToast } from "@/components/Toast";
import { timeAgo } from "@/lib/format";

const REASONS = [["not_visible", "Not visible"], ["wrong_item", "Wrong item"], ["duplicate", "Duplicate"], ["inappropriate", "Inappropriate"]] as const;

export function ReviewRow(p: {
  slug: string; id: string; status: string; kind: string; imageUrl: string | null; linkUrl: string | null; linkNormalized: string | null; handle: string | null; orderNumber: string | null; caption: string | null;
  createdAt: string; seen: number; rejectReason: string | null; rejectMode: string | null; quest: { title: string; type: string; xp: number } | null; fan: { display_name: string | null; email: string; handles: Record<string, string | null> } | null;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>("not_visible");
  const [note, setNote] = useState("");
  const [mode, setMode] = useState<"retry" | "final">("retry");
  const [pending, start] = useTransition();
  const { push } = useToast();
  const router = useRouter();

  function onApprove() {
    start(async () => {
      const r = await approve(p.slug, p.id);
      if (!r.ok) return push(r.error, "error");
      push(r.data.already ? "Already handled" : `Approved · +${r.data.xp} XP to the fan`, "info");
      router.refresh();
    });
  }
  function onReject() {
    start(async () => {
      const r = await reject(p.slug, p.id, reason, note, mode);
      if (!r.ok) return push(r.error, "error");
      push("Rejected", "info");
      router.refresh();
    });
  }
  const fanHandles = Object.entries(p.fan?.handles ?? {}).filter(([, v]) => v).map(([k, v]) => `${k}: @${v}`).join(" · ");
  return (
    <article className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span><span className="text-text">{p.fan?.display_name ?? "No name"}</span> · {p.fan?.email}</span>
        <span>{timeAgo(p.createdAt)} ago{p.seen > 1 ? ` · seen ${p.seen} times` : ""}</span>
      </div>
      <h3 className="display mt-2 text-2xl">{p.quest?.title} <span className="text-muted">{p.quest?.xp} XP</span></h3>
      {(p.handle || fanHandles) && <p className="mt-1 text-xs text-muted">Handle: {p.handle ? `@${p.handle.replace(/^@/, "")}` : ""}{fanHandles ? ` (${fanHandles})` : ""}</p>}
      {p.orderNumber && <p className="mt-1 text-xs text-muted">Order number: <span className="text-text">{p.orderNumber}</span></p>}
      {p.caption && <p className="mt-1 text-sm">{p.caption}</p>}
      {p.kind === "link" ? (
        <p className="mt-3 break-all text-sm"><a href={p.linkUrl ?? "#"} target="_blank" rel="noopener noreferrer" className="text-accent underline">{p.linkUrl}</a><br /><span className="text-xs text-muted">{p.linkNormalized}</span></p>
      ) : p.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <a href={p.imageUrl} target="_blank" rel="noopener noreferrer"><img src={p.imageUrl} alt="Proof" className="mt-3 max-h-96 w-full rounded-[var(--radius-sm)] bg-bg object-contain" /></a>
      ) : (
        <p className="mt-3 text-sm text-danger">Image missing.</p>
      )}
      {p.status === "rejected" && <p className="mt-2 text-xs text-danger">Rejected: {p.rejectReason} ({p.rejectMode})</p>}
      {p.status === "pending" && (
        <div className="mt-4 space-y-3">
          <div className="flex gap-2">
            <button type="button" className="btn btn-primary flex-1" disabled={pending} onClick={onApprove}>Approve</button>
            <button type="button" className="btn btn-secondary flex-1" disabled={pending} onClick={() => setOpen((o) => !o)}>Reject…</button>
          </div>
          {open && (
            <div className="space-y-2 rounded-[var(--radius-sm)] bg-surface-2 p-3">
              <div className="flex flex-wrap gap-2">
                {REASONS.map(([v, l]) => (
                  <button key={v} type="button" className={`label ${reason === v ? "border-accent text-text" : ""}`} onClick={() => setReason(v)}>{l}</button>
                ))}
              </div>
              <input className="input" placeholder="Optional note to the fan (200 characters)" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
              <div className="flex items-center gap-4 text-sm">
                <label className="flex items-center gap-2"><input type="radio" checked={mode === "retry"} onChange={() => setMode("retry")} /> Let them retry once</label>
                <label className="flex items-center gap-2"><input type="radio" checked={mode === "final"} onChange={() => setMode("final")} /> Final</label>
              </div>
              <button type="button" className="btn btn-secondary w-full" disabled={pending} onClick={onReject}>Confirm rejection</button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
