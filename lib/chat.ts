export type ChatMessage = { id: string; fan_id: string; display_name: string; body: string; created_at: string; is_admin: boolean };

/** One page of chat_recent; "Load earlier" shows while a page came back full. */
export const CHAT_PAGE = 50;
export const CHAT_MAX = 500;

/** Merge by id, keeping rows already loaded, oldest first. */
export function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byId = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || a.id.localeCompare(b.id));
}

/** A fresh chat_recent page is authoritative for the window it covers: rows it no longer returns (deleted, hidden) go; rows older than a full page stay. */
export function replaceWindow(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const floor = incoming.length >= CHAT_PAGE ? Math.min(...incoming.map((m) => Date.parse(m.created_at))) : -Infinity;
  return mergeMessages(current.filter((m) => Date.parse(m.created_at) < floor), incoming);
}

export function onlineLabel(n: number) {
  return `${n} FAN${n === 1 ? "" : "S"} ONLINE`;
}
