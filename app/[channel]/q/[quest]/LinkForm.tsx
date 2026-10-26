"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSubmission } from "@/app/[channel]/actions";
import { normalizeSocialLink } from "@/lib/links";

export function LinkForm({ slug, questId, reviewCadence }: { slug: string; questId: string; reviewCadence?: string }) {
  const [url, setUrl] = useState("");
  const [handle, setHandle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const check = url ? normalizeSocialLink(url) : null;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!check?.ok) return setError(check?.reason === "host" ? "Only Instagram, TikTok and Facebook links count." : "Paste the full https link to your post.");
    if (handle.trim().length < 2) return setError("Add your handle so the band can match the post to you.");
    start(async () => {
      const r = await createSubmission(slug, questId, { kind: "link", linkUrl: url, handle });
      if (!r.ok) return setError(r.error);
      setDone(true);
      router.refresh();
    });
  }

  if (done) {
    return (
      <div className="card p-5">
        <p className="display text-3xl">Submitted</p>
        <p className="mt-1 text-sm text-muted">XP lands when the band opens your link. {reviewCadence ?? ""}</p>
      </div>
    );
  }
  return (
    <form onSubmit={onSubmit} className="card space-y-3 p-5">
      <div>
        <label className="block text-xs uppercase tracking-[0.12em] text-muted" htmlFor="url">Link to your post</label>
        <input id="url" className="input mt-1" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.instagram.com/p/…" required />
        {check && check.ok && <p className="mt-1 text-xs text-success">{check.platform} · {check.normalized}</p>}
        {check && !check.ok && url.length > 8 && <p className="mt-1 text-xs text-danger">{check.reason === "host" ? "Only Instagram, TikTok and Facebook links count." : "Needs to be a full https link."}</p>}
      </div>
      <div>
        <label className="block text-xs uppercase tracking-[0.12em] text-muted" htmlFor="handle">Your handle on that platform</label>
        <input id="handle" className="input mt-1" maxLength={60} value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@handle" required />
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <button type="submit" className="btn btn-primary w-full" disabled={pending}>{pending ? "Sending…" : "Submit link"}</button>
    </form>
  );
}
