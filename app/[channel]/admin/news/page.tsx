import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "../_lib";
import { saveNews, deleteNews } from "../actions";

export const dynamic = "force-dynamic";

function NewsForm({ slug, item }: { slug: string; item: { id: string; title: string; body: string | null; image_url: string | null; link_url: string | null; link_label: string | null; sort_order: number; is_active: boolean } | null }) {
  return (
    <form action={saveNews.bind(null, slug, item?.id ?? null)} className="card space-y-3 p-4">
      <h3 className="display text-xl">{item ? "Edit" : "New item"}</h3>
      <input name="title" className="input" placeholder="Title" defaultValue={item?.title ?? ""} required maxLength={120} />
      <textarea name="body" className="input" placeholder="Body (300 characters)" defaultValue={item?.body ?? ""} maxLength={300} />
      <input name="image_url" className="input" placeholder="Image URL (optional)" defaultValue={item?.image_url ?? ""} />
      <div className="grid grid-cols-2 gap-2">
        <input name="link_url" className="input" placeholder="Link URL" defaultValue={item?.link_url ?? ""} />
        <input name="link_label" className="input" placeholder="Link label" defaultValue={item?.link_label ?? ""} maxLength={30} />
      </div>
      <div className="flex items-center gap-4 text-sm">
        <label className="flex items-center gap-2">Order <input name="sort_order" type="number" className="input w-24" defaultValue={item?.sort_order ?? 100} /></label>
        <label className="flex items-center gap-2"><input type="checkbox" name="is_active" defaultChecked={item?.is_active ?? true} /> Live</label>
      </div>
      <button type="submit" className="btn btn-primary w-full">Save</button>
    </form>
  );
}

export default async function NewsAdmin({ params }: { params: Promise<{ channel: string }> }) {
  const { channel: slug } = await params;
  const { channel } = await requireAdmin(slug);
  const sb = await createClient();
  const { data: items } = await sb.from("news_items").select("*").eq("channel_id", channel.id).order("sort_order");
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        {(items ?? []).map((n) => (
          <div key={n.id} className="space-y-2">
            <NewsForm slug={slug} item={n} />
            <form action={deleteNews.bind(null, slug, n.id)}><button className="btn btn-ghost text-xs text-danger">Delete</button></form>
          </div>
        ))}
      </div>
      <NewsForm slug={slug} item={null} />
    </div>
  );
}
