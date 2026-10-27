import { admin, resetTestFans } from "./helpers";

/** After a run, test fans' XP, proofs and chat are wiped so nothing from the run shows on the live feed; the fans then leave the public boards, and anything the admin test changed is restored. */
export default async function globalTeardown() {
  await resetTestFans();
  const sb = admin();
  const { data: admins } = await sb.from("channel_admins").select("fan_id");
  const adminIds = (admins ?? []).map((a) => a.fan_id);
  const { data: fans } = await sb.from("fans").select("id").like("email", "%@test.dbm");
  const ids = (fans ?? []).map((f) => f.id).filter((id) => !adminIds.includes(id));
  if (ids.length) await sb.from("fans").update({ status: "hidden" }).in("id", ids);
  await sb.from("quests").update({ xp: 100 }).eq("title", "Tag us");
}
