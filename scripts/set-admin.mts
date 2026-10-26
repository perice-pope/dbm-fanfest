// Grants (or revokes) admin on a channel for an existing account.
// Run: node --env-file=.env.local scripts/set-admin.mts someone@example.com [destroyedbymoths] [--remove]
import { createClient } from "@supabase/supabase-js";

const [email, slugArg] = process.argv.slice(2);
if (!email) throw new Error("Usage: set-admin.mts <email> [channel-slug] [--remove]");
const slug = slugArg && !slugArg.startsWith("--") ? slugArg : "destroyedbymoths";
const remove = process.argv.includes("--remove");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: ch } = await sb.from("channels").select("id").eq("slug", slug).single();
if (!ch) throw new Error(`No channel ${slug}`);
const { data: fan } = await sb.from("fans").select("id").ilike("email", email).maybeSingle();
if (!fan) throw new Error(`No account for ${email}. They must sign in once first.`);
if (remove) {
  const { count } = await sb.from("channel_admins").select("fan_id", { count: "exact", head: true }).eq("channel_id", ch.id);
  if ((count ?? 0) <= 1) throw new Error("Refusing to remove the last admin.");
  await sb.from("channel_admins").delete().eq("channel_id", ch.id).eq("fan_id", fan.id);
  console.log(`removed admin ${email} on ${slug}`);
} else {
  await sb.from("channel_admins").upsert({ channel_id: ch.id, fan_id: fan.id });
  console.log(`admin ${email} on ${slug}`);
}
