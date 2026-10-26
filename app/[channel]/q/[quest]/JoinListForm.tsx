"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { joinEmailList } from "@/app/[channel]/actions";
import { useToast } from "@/components/Toast";

export function JoinListForm({ slug, consent, joined }: { slug: string; consent: string; joined: boolean }) {
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(joined);
  const [pending, start] = useTransition();
  const { push } = useToast();
  const router = useRouter();
  if (done) return <p className="card p-5 text-sm"><span className="text-success">You are on the list.</span> Change this any time in Account.</p>;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const r = await joinEmailList(slug);
          if (!r.ok) return setError(r.error);
          setDone(true);
          if (r.data.awarded) push(`+${r.data.xp.toLocaleString()} XP`, "xp");
          else if (!r.data.joined) push("You were already on the list.", "info");
          router.refresh();
        });
      }}
      className="card space-y-3 p-5"
    >
      <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--accent)]" checked={agree} onChange={(e) => setAgree(e.target.checked)} /> {consent}</label>
      {error && <p className="text-sm text-danger">{error}</p>}
      <button type="submit" className="btn btn-primary w-full" disabled={!agree || pending}>{pending ? "Joining…" : "Join the list"}</button>
    </form>
  );
}
