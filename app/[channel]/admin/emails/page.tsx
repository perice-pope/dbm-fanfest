import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "../_lib";

export const dynamic = "force-dynamic";

export default async function EmailsAdmin({ params }: { params: Promise<{ channel: string }> }) {
  const { channel: slug } = await params;
  const { channel } = await requireAdmin(slug);
  const sb = await createClient();
  const { data: rows } = await sb.from("email_signups").select("email, consented_at, fans(display_name, newsletter_opt_in)").eq("channel_id", channel.id).order("consented_at", { ascending: false });
  const list = (rows ?? []).filter((r) => (r.fans as { newsletter_opt_in: boolean } | null)?.newsletter_opt_in !== false);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{list.length} opted in. Fans who untick email in their account drop off this list.</p>
        <a href={`/${slug}/admin/emails/export`} className="btn btn-primary">Export CSV</a>
      </div>
      <ul className="card divide-y divide-line text-sm">
        {list.map((r, i) => <li key={i} className="flex gap-3 p-3"><span className="flex-1 truncate">{r.email}</span><span className="text-muted">{(r.fans as { display_name: string | null } | null)?.display_name ?? ""}</span><span className="text-muted">{new Date(r.consented_at).toLocaleDateString()}</span></li>)}
        {list.length === 0 && <li className="p-5 text-muted">Nobody yet.</li>}
      </ul>
    </div>
  );
}
