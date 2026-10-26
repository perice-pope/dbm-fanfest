import { createClient } from "@/lib/supabase/server";
import { requireAdmin, signedProofUrl } from "../_lib";
import { ReviewRow } from "./ReviewRow";

export const dynamic = "force-dynamic";

export default async function ReviewPage({ params, searchParams }: { params: Promise<{ channel: string }>; searchParams: Promise<{ status?: string }> }) {
  const { channel: slug } = await params;
  const { status = "pending" } = await searchParams;
  const { channel } = await requireAdmin(slug);
  const sb = await createClient();
  const { data: rows } = await sb
    .from("submissions")
    .select("*, quests(title, type, xp, config), fans!fan_id(display_name, email, handles)")
    .eq("channel_id", channel.id)
    .eq("status", status)
    .order("created_at", { ascending: status === "pending" })
    .limit(100);
  const list = rows ?? [];
  // Hide auto-approved uploads from the queue; they live under Uploads.
  const queue = list.filter((r) => !((r.quests as { config?: { auto_approve?: boolean } } | null)?.config?.auto_approve));
  const seen = new Map<string, number>();
  for (const r of list) if (r.file_sha256) seen.set(r.file_sha256, (seen.get(r.file_sha256) ?? 0) + 1);
  const items = await Promise.all(queue.map(async (r) => ({ row: r, url: await signedProofUrl(r.image_path), seen: r.file_sha256 ? seen.get(r.file_sha256) ?? 1 : 1 })));
  return (
    <div className="space-y-4">
      <div className="seg">
        {(["pending", "approved", "rejected"] as const).map((s) => (
          <a key={s} href={`/${slug}/admin/review?status=${s}`}><button type="button" aria-pressed={s === status}>{s}</button></a>
        ))}
      </div>
      {items.length === 0 && <p className="card p-5 text-sm text-muted">Nothing {status}.</p>}
      {items.map(({ row, url, seen }) => (
        <ReviewRow key={row.id} slug={slug} id={row.id} status={row.status} kind={row.kind} imageUrl={url} linkUrl={row.link_url} linkNormalized={row.link_normalized}
          handle={row.handle} orderNumber={row.order_number} caption={row.caption} createdAt={row.created_at} seen={seen} rejectReason={row.reject_reason} rejectMode={row.reject_mode}
          quest={(row.quests as { title: string; type: string; xp: number } | null)} fan={(row.fans as { display_name: string | null; email: string; handles: Record<string, string | null> } | null)} />
      ))}
    </div>
  );
}
