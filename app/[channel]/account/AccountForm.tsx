"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateProfile } from "@/app/[channel]/actions";
import { useToast } from "@/components/Toast";

type FanFields = { display_name: string | null; instagram: string; tiktok: string; show_on_leaderboard: boolean; show_activity: boolean; newsletter_opt_in: boolean; referral_code: string };

export function AccountForm({ slug, next, fan }: { slug: string; next?: string; fan: FanFields }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const { push } = useToast();
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const r = await updateProfile(slug, fd);
      if (!r.ok) return setError(r.error);
      push("Saved", "info");
      if (next && /^\/(?![/\\])/.test(next)) router.replace(next); else router.refresh();
    });
  }
  return (
    <form onSubmit={onSubmit} className="card mt-5 space-y-4 p-5">
      <div>
        <label className="block text-xs uppercase tracking-[0.12em] text-muted" htmlFor="display_name">Display name</label>
        <input id="display_name" name="display_name" className="input mt-1" defaultValue={fan.display_name ?? ""} minLength={2} maxLength={24} required autoFocus={!fan.display_name} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs uppercase tracking-[0.12em] text-muted" htmlFor="instagram">Instagram</label>
          <input id="instagram" name="instagram" className="input mt-1" defaultValue={fan.instagram} placeholder="@handle" maxLength={60} />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-[0.12em] text-muted" htmlFor="tiktok">TikTok</label>
          <input id="tiktok" name="tiktok" className="input mt-1" defaultValue={fan.tiktok} placeholder="@handle" maxLength={60} />
        </div>
      </div>
      <p className="text-xs text-muted">Handles help the band match your social proofs to you. Optional.</p>
      <fieldset className="space-y-2 border-t border-line pt-4">
        <legend className="text-xs uppercase tracking-[0.12em] text-muted">Privacy</legend>
        <label className="flex items-center gap-3 text-sm"><input type="checkbox" name="show_on_leaderboard" defaultChecked={fan.show_on_leaderboard} className="h-4 w-4 accent-[var(--accent)]" /> Show me on the leaderboard</label>
        <label className="flex items-center gap-3 text-sm"><input type="checkbox" name="show_activity" defaultChecked={fan.show_activity} className="h-4 w-4 accent-[var(--accent)]" /> Show my name in Recent activity</label>
        <label className="flex items-center gap-3 text-sm"><input type="checkbox" name="newsletter_opt_in" defaultChecked={fan.newsletter_opt_in} className="h-4 w-4 accent-[var(--accent)]" /> Email me about the band</label>
      </fieldset>
      {error && <p className="text-sm text-danger">{error}</p>}
      <button type="submit" className="btn btn-primary w-full" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
    </form>
  );
}
