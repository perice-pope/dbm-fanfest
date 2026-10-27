// Seeds filler fans, their XP history, extra rows for the owner and a chat backlog so the live site looks busy.
// Run: node --env-file=.env.local scripts/seed-filler.mts [--slug destroyedbymoths] [--me perice09@gmail.com] [--remove] [--refresh]
// Everything it writes is marked (fans.is_seed, chat_messages.is_seed, xp_ledger.ref_type = 'seed') and --remove takes exactly that back.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types.ts";
import { LIVE_QUESTS, ME, SEED_DOMAIN, awardKey, makePlan, monthStart } from "./filler-plan.mts";

const argv = process.argv.slice(2);
const flag = (name: string) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const slug = flag("--slug") ?? "destroyedbymoths";
const meEmail = flag("--me") ?? "perice09@gmail.com";
const remove = argv.includes("--remove");
const refresh = argv.includes("--refresh");
const CHUNK = 500;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY");
const sb = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: ch } = await sb.from("channels").select("id, timezone").eq("slug", slug).single();
if (!ch) throw new Error(`No channel ${slug}`);

async function inChunks<T>(rows: T[], write: (batch: T[]) => PromiseLike<{ error: { message: string } | null }>) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await write(rows.slice(i, i + CHUNK));
    if (error) throw new Error(error.message);
  }
}

/** Deletes seeded auth users (their fans, ledger and chat rows cascade), seeded chat rows and seeded ledger rows. Nothing else. */
async function removeFiller() {
  const { data: seeded, error } = await sb.from("fans").select("id").eq("is_seed", true);
  if (error) throw error;
  const { count: chatN } = await sb.from("chat_messages").select("id", { count: "exact", head: true }).eq("is_seed", true);
  const { count: ledgerN } = await sb.from("xp_ledger").select("id", { count: "exact", head: true }).eq("ref_type", "seed");
  for (const f of seeded ?? []) {
    const { error: delErr } = await sb.auth.admin.deleteUser(f.id);
    if (delErr) throw delErr;
  }
  const chat = await sb.from("chat_messages").delete().eq("is_seed", true);
  if (chat.error) throw chat.error;
  const ledger = await sb.from("xp_ledger").delete().eq("ref_type", "seed");
  if (ledger.error) throw ledger.error;
  console.log(`removed ${seeded?.length ?? 0} seeded fans (auth users), ${chatN ?? 0} seeded chat rows, ${ledgerN ?? 0} seeded ledger rows`);
}

async function seedFiller() {
  const { data: quests, error: qErr } = await sb.from("quests").select("id, title, type, xp, repeat_rule").eq("channel_id", ch!.id).eq("status", "live");
  if (qErr) throw qErr;
  const byTitle = new Map(quests.map((q) => [q.title, q]));
  const missing = LIVE_QUESTS.filter((q) => !byTitle.has(q.title)).map((q) => q.title);
  if (missing.length) throw new Error(`Live quests missing on ${slug}: ${missing.join(" | ")}`);

  const { data: me } = await sb.from("fans").select("id, display_name").ilike("email", meEmail).maybeSingle();
  const skipMine = new Set<string>();
  if (me) {
    const { data: mine, error } = await sb.from("xp_ledger").select("quest_id, period_key").eq("fan_id", me.id).eq("channel_id", ch!.id).gt("xp", 0);
    if (error) throw error;
    for (const row of mine) {
      const q = quests.find((x) => x.id === row.quest_id);
      if (q) skipMine.add(awardKey(q.title, row.period_key));
    }
  } else console.warn(`No fan for ${meEmail}: skipping the owner's rows`);

  const now = new Date();
  const plan = makePlan({ now, tz: ch!.timezone, quests, skipMine });

  // Every filler fan needs an auth user; the on_auth_user_created trigger makes the fans row, which we then fill in.
  const ids = new Map<string, string>();
  const { data: existing } = await sb.from("fans").select("id, email").like("email", `%@${SEED_DOMAIN}`);
  for (const f of existing ?? []) ids.set(f.email.toLowerCase(), f.id);
  let created = 0;
  for (const fan of plan.fans) {
    let id = ids.get(fan.email);
    if (!id) {
      const { data, error } = await sb.auth.admin.createUser({ email: fan.email, email_confirm: true });
      if (error) throw error;
      id = data.user!.id;
      created++;
    }
    ids.set(fan.email, id);
    const { error } = await sb.from("fans")
      .update({ display_name: fan.name, is_seed: true, created_at: fan.createdAt.toISOString(), last_seen_at: fan.lastSeenAt.toISOString() })
      .eq("id", id);
    if (error) throw error;
  }
  if (me) ids.set(ME, me.id);
  const fanId = (who: string) => {
    const id = ids.get(who);
    if (!id) throw new Error(`No fan id for ${who}`);
    return id;
  };

  const ledgerRows = plan.awards.filter((a) => a.who !== ME || me).map((a) => ({
    channel_id: ch!.id, fan_id: fanId(a.who), quest_id: byTitle.get(a.title)!.id, source: a.source, ref_type: "seed", ref_id: null,
    period_key: a.periodKey, xp: a.xp, note: a.title, created_at: a.at.toISOString(),
  }));
  await inChunks(ledgerRows, (batch) => sb.from("xp_ledger").insert(batch));
  const chatRows = plan.chat.filter((c) => c.who !== ME || me).map((c) => ({
    channel_id: ch!.id, fan_id: fanId(c.who), body: c.body, is_seed: true, created_at: c.at.toISOString(),
  }));
  await inChunks(chatRows, (batch) => sb.from("chat_messages").insert(batch));

  let monthXp = 0;
  const since = monthStart(ch!.timezone, now).toISOString();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from("xp_ledger").select("xp").eq("channel_id", ch!.id).gt("xp", 0).gte("created_at", since)
      .order("created_at").order("id").range(from, from + 999);
    if (error) throw error;
    for (const row of data) monthXp += row.xp;
    if (data.length < 1000) break;
  }
  const { data: online } = await sb.rpc("fans_online", { p_channel: ch!.id });
  console.log(`fans created: ${created} of ${plan.fans.length} seeded`);
  console.log(`ledger rows: ${ledgerRows.length}`);
  console.log(`chat rows: ${chatRows.length}`);
  console.log(`XP earned this month: ${monthXp}`);
  console.log(`fans online now: ${online ?? 0}`);
  if (!me) return;
  for (const period of ["weekly", "monthly", "lifetime"]) {
    const { data, error } = await sb.rpc("leaderboard", { p_channel: ch!.id, p_period: period, p_limit: 10000, p_offset: 0 });
    if (error) throw error;
    const row = data.find((r) => r.fan_id === me.id);
    console.log(`${me.display_name ?? meEmail} ${period}: ${row ? `rank ${row.rank} with ${row.xp} xp` : "not on the board (admin or hidden)"} of ${data.length}`);
  }
}

if (remove || refresh) await removeFiller();
if (!remove) {
  const { count } = await sb.from("fans").select("id", { count: "exact", head: true }).eq("is_seed", true);
  if ((count ?? 0) > 0) {
    console.error(`${count} seeded fans already exist. Run with --refresh to replace them or --remove to delete them.`);
    process.exit(1);
  }
  await seedFiller();
}
