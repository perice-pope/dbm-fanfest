import { createClient } from "@/lib/supabase/server";
import { requireAdmin, signedProofUrl } from "../_lib";
import { UploadTile } from "./UploadTile";

export const dynamic = "force-dynamic";

export default async function UploadsPage({ params }: { params: Promise<{ channel: string }> }) {
  const { channel: slug } = await params;
  const { channel } = await requireAdmin(slug);
  const sb = await createClient();
  const { data: rows } = await sb.from("submissions").select("*, quests(title, config), fans!fan_id(display_name)").eq("channel_id", channel.id).eq("status", "approved").eq("kind", "image").order("created_at", { ascending: false }).limit(200);
  const uploads = (rows ?? []).filter((r) => (r.quests as { config?: { auto_approve?: boolean } } | null)?.config?.auto_approve);
  const items = await Promise.all(uploads.map(async (r) => ({ row: r, url: await signedProofUrl(r.image_path) })));
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">Fan art and merch-in-the-wild photos paid XP on upload. Feature and Hide keep the XP; Remove reverses it.</p>
      {items.length === 0 && <p className="card p-5 text-sm text-muted">No uploads yet.</p>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(({ row, url }) => (
          <UploadTile key={row.id} slug={slug} id={row.id} url={url} title={(row.quests as { title: string } | null)?.title ?? ""} fan={(row.fans as { display_name: string | null } | null)?.display_name ?? "No name"}
            caption={row.caption} consent={row.consent_featured} featured={!!row.featured_at} hidden={!!row.hidden_at} removed={!!row.removed_at} />
        ))}
      </div>
    </div>
  );
}
