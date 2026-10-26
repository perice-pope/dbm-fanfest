import { deflateSync } from "node:zlib";
import { createClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";

export const SLUG = "destroyedbymoths";
export const ADMIN = "admin@test.dbm";
export const FAN1 = "fan1@test.dbm";
export const FAN2 = "fan2@test.dbm";
export const FAN3 = "fan3@test.dbm";

export function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Tests need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (run with node --env-file or dotenv)");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Signs a test account in without email: a magic-link token hash goes straight to /auth/confirm. */
export async function signIn(page: Page, email: string, next = `/${SLUG}`) {
  const sb = admin();
  const { data, error } = await sb.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data.properties?.hashed_token) throw error ?? new Error("no token");
  await page.goto(`/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink&next=${encodeURIComponent(next)}`);
  await page.waitForURL((u) => !u.pathname.startsWith("/auth/"), { timeout: 20_000 });
}

/** Wipes everything the test fans did, keeping their accounts and names. */
export async function resetTestFans() {
  const sb = admin();
  const { data: fans } = await sb.from("fans").select("id").like("email", "%@test.dbm");
  const ids = (fans ?? []).map((f) => f.id);
  if (ids.length === 0) return;
  for (const t of ["xp_ledger", "submissions", "quest_responses", "reward_claims", "reward_entries", "email_signups", "link_visits"] as const) {
    await sb.from(t).delete().in("fan_id", ids);
  }
  await sb.from("invites").delete().in("invitee_fan_id", ids);
  await sb.from("fans").update({ status: "active", show_on_leaderboard: true, show_activity: true, newsletter_opt_in: false }).in("id", ids);
  // Reopen draws the admin test may have closed.
  await sb.from("rewards").update({ picked_at: null, winner_fan_id: null, status: "live" }).eq("type", "draw");
}

export async function fanXp(email: string) {
  const sb = admin();
  const { data: fan } = await sb.from("fans").select("id").eq("email", email).single();
  const { data: ch } = await sb.from("channels").select("id").eq("slug", SLUG).single();
  const { data } = await sb.rpc("fan_total_xp", { p_channel: ch!.id, p_fan: fan!.id });
  return Number(data ?? 0);
}

export async function questId(title: string) {
  const sb = admin();
  const { data } = await sb.from("quests").select("id").ilike("title", title).limit(1).single();
  return data!.id;
}

/** A small valid PNG whose pixels depend on the seed, so different seeds hash differently after JPEG re-encoding. */
export function pngBuffer(seed = 1, size = 16) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const rows: Buffer[] = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3);
    row[0] = 0;
    for (let x = 0; x < size; x++) {
      row[1 + x * 3] = (seed * 37 + x * 11) & 255;
      row[2 + x * 3] = (seed * 91 + y * 23) & 255;
      row[3 + x * 3] = (seed * 53 + x * y) & 255;
    }
    rows.push(row);
  }
  const idat = deflateSync(Buffer.concat(rows));
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

function chunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}

function crc32(buf: Buffer) {
  let crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    let c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
