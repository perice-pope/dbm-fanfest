"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { moderate } from "../actions";
import { useToast } from "@/components/Toast";

export function UploadTile(p: { slug: string; id: string; url: string | null; title: string; fan: string; caption: string | null; consent: boolean; featured: boolean; hidden: boolean; removed: boolean }) {
  const [pending, start] = useTransition();
  const { push } = useToast();
  const router = useRouter();
  function act(action: "feature" | "unfeature" | "hide" | "unhide" | "remove") {
    if (action === "remove" && !window.confirm("Remove this upload and reverse its XP?")) return;
    start(async () => {
      const r = await moderate(p.slug, p.id, action, action === "remove" ? "Removed by the band" : undefined);
      if (!r.ok) return push(r.error, "error");
      router.refresh();
    });
  }
  return (
    <article className={`card overflow-hidden ${p.removed ? "opacity-50" : ""}`}>
      {p.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.url} alt={p.caption ?? "Upload"} className="aspect-square w-full bg-bg object-cover" />
      ) : <div className="aspect-square w-full bg-surface-2" />}
      <div className="space-y-2 p-3 text-sm">
        <p className="text-xs text-muted">{p.title} · {p.fan}{p.consent ? " · may share" : " · no share consent"}</p>
        {p.caption && <p>{p.caption}</p>}
        <div className="flex flex-wrap gap-1">
          {p.featured && <span className="label border-accent text-accent">Featured</span>}
          {p.hidden && !p.removed && <span className="label">Hidden</span>}
          {p.removed && <span className="label border-danger text-danger">Removed</span>}
        </div>
        {!p.removed && (
          <div className="flex flex-wrap gap-2">
            {p.consent && <button type="button" className="btn btn-secondary px-3 text-sm" disabled={pending} onClick={() => act(p.featured ? "unfeature" : "feature")}>{p.featured ? "Unfeature" : "Feature"}</button>}
            <button type="button" className="btn btn-secondary px-3 text-sm" disabled={pending} onClick={() => act(p.hidden ? "unhide" : "hide")}>{p.hidden ? "Unhide" : "Hide"}</button>
            <button type="button" className="btn btn-ghost px-3 text-sm text-danger" disabled={pending} onClick={() => act("remove")}>Remove</button>
          </div>
        )}
      </div>
    </article>
  );
}
