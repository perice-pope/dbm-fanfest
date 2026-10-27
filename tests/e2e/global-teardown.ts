import { admin } from "./helpers";

/** After a run, test fans leave the public boards and chat, and anything the admin test changed is restored. */
export default async function globalTeardown() {
  const sb = admin();
  const { data: admins } = await sb.from("channel_admins").select("fan_id");
  const adminIds = (admins ?? []).map((a) => a.fan_id);
  const { data: fans } = await sb.from("fans").select("id").like("email", "%@test.dbm");
  const testIds = (fans ?? []).map((f) => f.id);
  const ids = testIds.filter((id) => !adminIds.includes(id));
  if (ids.length) await sb.from("fans").update({ status: "hidden" }).in("id", ids);
  if (testIds.length) await sb.from("chat_messages").delete().in("fan_id", testIds);
  await sb.from("rewards").update({ picked_at: null, winner_fan_id: null, status: "live" }).eq("type", "draw");
  await sb.from("quests").update({ xp: 100 }).eq("title", "Tag us");
}
