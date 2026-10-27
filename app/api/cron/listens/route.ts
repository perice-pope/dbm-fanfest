import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { syncFan } from "@/lib/listenbrainz";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Vercel Cron: pays every connected fan's new plays for each live listening quest. Draft quests are skipped. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = createAdminClient();
  const [{ data: quests }, { data: accounts }] = await Promise.all([
    sb.from("quests").select("id").eq("type", "listen").eq("status", "live"),
    sb.from("listen_accounts").select("fan_id, fans!inner(status)").neq("fans.status", "banned"),
  ]);
  const started = Date.now();
  const totals = { fans: 0, awarded: 0, xp: 0, errors: 0, stoppedEarly: false };
  outer: for (const q of quests ?? []) {
    for (const a of accounts ?? []) {
      // Stay inside the function limit; the next run picks up where the cursor stopped.
      if (Date.now() - started > 240_000) { totals.stoppedEarly = true; break outer; }
      try {
        const r = await syncFan(a.fan_id, q.id);
        totals.fans++; totals.awarded += r.awarded; totals.xp += r.xp;
      } catch { totals.errors++; }
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  return NextResponse.json({ quests: quests?.length ?? 0, accounts: accounts?.length ?? 0, ...totals });
}
