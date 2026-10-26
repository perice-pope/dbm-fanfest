// Creates confirmed test accounts and makes the first one a channel admin. Needs SUPABASE_SECRET_KEY.
// Run: node --env-file=.env.local scripts/seed-test-users.mts
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY");
const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const slug = process.argv[2] ?? "destroyedbymoths";

const USERS = [
  { email: "admin@test.dbm", name: "Adam the Admin", admin: true },
  { email: "fan1@test.dbm", name: "Fan One", admin: false },
  { email: "fan2@test.dbm", name: "Fan Two", admin: false },
  { email: "fan3@test.dbm", name: "Fan Three", admin: false },
];

const { data: ch, error: chErr } = await sb.from("channels").select("id").eq("slug", slug).single();
if (chErr || !ch) throw new Error(`No channel ${slug}`);
const { data: list } = await sb.auth.admin.listUsers({ perPage: 1000 });
for (const u of USERS) {
  let user = list?.users.find((x) => x.email === u.email);
  if (!user) {
    const { data, error } = await sb.auth.admin.createUser({ email: u.email, email_confirm: true });
    if (error) throw error;
    user = data.user!;
  }
  await sb.from("fans").update({ display_name: u.name }).eq("id", user.id);
  if (u.admin) await sb.from("channel_admins").upsert({ channel_id: ch.id, fan_id: user.id });
  console.log(`${u.admin ? "admin" : "fan  "} ${u.email} ${user.id}`);
}
