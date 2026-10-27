import { requireAdmin } from "../_lib";
import { saveSettings } from "../actions";
import { settingsOf } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function SettingsAdmin({ params, searchParams }: { params: Promise<{ channel: string }>; searchParams: Promise<{ saved?: string; error?: string }> }) {
  const { channel: slug } = await params;
  const { saved, error } = await searchParams;
  const { channel } = await requireAdmin(slug);
  const s = settingsOf(channel);
  const links = (channel.links ?? {}) as Record<string, string | null>;
  return (
    <form action={saveSettings.bind(null, slug)} className="card space-y-3 p-5">
      {saved && <p className="text-sm text-success">Saved.</p>}
      {error === "timezone" && <p className="text-sm text-danger">That time zone is not a valid IANA name (for example America/Los_Angeles). Nothing was saved.</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Name<input name="name" className="input mt-1" defaultValue={channel.name} required /></label>
        <label className="text-sm">Tagline<input name="tagline" className="input mt-1" defaultValue={channel.tagline ?? ""} /></label>
        <label className="text-sm">Time zone (IANA)<input name="timezone" className="input mt-1" defaultValue={channel.timezone} /></label>
        <label className="text-sm">Accent colour<input name="accent" type="color" className="input mt-1 h-12" defaultValue={s.theme?.accent ?? "#f2b441"} /></label>
        <label className="text-sm">Merch store name<input name="merch_store_name" className="input mt-1" defaultValue={s.merch_store_name ?? ""} /></label>
        <label className="text-sm">Review cadence line<input name="review_cadence" className="input mt-1" defaultValue={s.review_cadence ?? ""} /></label>
        <label className="text-sm">Submissions per fan per day<input name="submissions_per_day" type="number" min={1} className="input mt-1" defaultValue={s.submissions_per_day ?? 10} /></label>
        <label className="text-sm">Max waiting per fan<input name="max_pending" type="number" min={1} className="input mt-1" defaultValue={s.max_pending ?? 5} /></label>
      </div>
      <h4 className="display pt-2 text-xl">Links</h4>
      <div className="grid gap-3 sm:grid-cols-2">
        {(["spotify", "apple", "instagram", "tiktok", "facebook", "youtube", "merch"] as const).map((k) => (
          <label key={k} className="text-sm capitalize">{k}<input name={`link_${k}`} className="input mt-1" defaultValue={links[k] ?? ""} /></label>
        ))}
      </div>
      <button className="btn btn-primary w-full">Save settings</button>
    </form>
  );
}
