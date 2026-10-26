import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "../_lib";

export const dynamic = "force-dynamic";

export default async function FansAdmin({ params, searchParams }: { params: Promise<{ channel: string }>; searchParams: Promise<{ q?: string }> }) {
  const { channel: slug } = await params;
  const { q = "" } = await searchParams;
  await requireAdmin(slug);
  const sb = await createClient();
  let query = sb.from("fans").select("id, display_name, email, status, created_at").order("created_at", { ascending: false }).limit(100);
  if (q) query = query.or(`display_name.ilike.%${q.replace(/[%,]/g, "")}%,email.ilike.%${q.replace(/[%,]/g, "")}%`);
  const { data: fans } = await query;
  return (
    <div className="space-y-3">
      <form className="flex gap-2"><input name="q" className="input" placeholder="Search name or email" defaultValue={q} /><button className="btn btn-secondary">Search</button></form>
      <ul className="card divide-y divide-line">
        {(fans ?? []).map((f) => (
          <li key={f.id} className="flex items-center gap-3 p-3 text-sm">
            <Link href={`/${slug}/admin/fans/${f.id}`} className="min-w-0 flex-1 truncate font-medium hover:text-accent">{f.display_name ?? "No name"} <span className="text-muted">· {f.email}</span></Link>
            <span className={`label ${f.status === "active" ? "" : "border-danger/40 text-danger"}`}>{f.status}</span>
          </li>
        ))}
        {(fans ?? []).length === 0 && <li className="p-5 text-sm text-muted">No fans match.</li>}
      </ul>
    </div>
  );
}
