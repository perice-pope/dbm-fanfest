"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/errors";
import { timeAgo } from "@/lib/format";
import { CHAT_MAX, CHAT_PAGE, mergeMessages, onlineLabel, replaceWindow, type ChatMessage } from "@/lib/chat";
import { useJoin } from "@/components/JoinModal";
import { useToast } from "@/components/Toast";

type Viewer = { id: string; name: string | null } | null;
type Props = { slug: string; channelId: string; online: number; initial: ChatMessage[]; viewer: Viewer; isAdmin: boolean; now: string };

/** The Figma Chat Bar pill plus the chat panel it opens. Messages come from chat_recent; Realtime and a 20 s poll keep them fresh. */
export function Chat({ slug, channelId, online, initial, viewer, isAdmin, now }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => mergeMessages([], initial));
  const [hasEarlier, setHasEarlier] = useState(initial.length >= CHAT_PAGE);
  const [nowIso, setNowIso] = useState(now);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nearBottom = useRef(true);
  const prependHeight = useRef<number | null>(null);
  const { push } = useToast();
  const { open: openJoin } = useJoin();
  const viewerId = viewer?.id;
  const n = new Date(nowIso);

  const refresh = useCallback(async () => {
    const { data } = await createClient().rpc("chat_recent", { p_channel: channelId, p_limit: CHAT_PAGE });
    if (data) setMessages((cur) => replaceWindow(cur, data));
  }, [channelId]);

  const close = useCallback(() => setOpen(false), []);

  function toggle() {
    if (open) return close();
    nearBottom.current = true;
    setOpen(true);
    void refresh();
  }

  // Relative times tick after mount so the server and client render the same labels first.
  useEffect(() => {
    const t = setInterval(() => setNowIso(new Date().toISOString()), 30_000);
    return () => clearInterval(t);
  }, []);

  // FANS ONLINE counts fans seen in the last 10 minutes, so a signed-in fan pings every 4 while the tab is visible.
  useEffect(() => {
    if (!viewerId) return;
    const sb = createClient();
    const ping = async () => { if (!document.hidden) await sb.rpc("touch_presence"); };
    void ping();
    const t = setInterval(() => { void ping(); }, 4 * 60_000);
    document.addEventListener("visibilitychange", ping);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", ping); };
  }, [viewerId]);

  useEffect(() => {
    const sb = createClient();
    const ch = sb
      .channel("chat:" + channelId)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: "channel_id=eq." + channelId }, () => { void refresh(); })
      .subscribe();
    return () => { void sb.removeChannel(ch); };
  }, [channelId, refresh]);

  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => { void refresh(); }, 20_000);
    return () => clearInterval(t);
  }, [open, refresh]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    if (window.matchMedia("(min-width: 1024px)").matches) inputRef.current?.focus();
  }, [open]);

  // New rows: keep the view pinned to the bottom when the viewer was already there; prepends keep their place.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (prependHeight.current != null) {
      el.scrollTop += el.scrollHeight - prependHeight.current;
      prependHeight.current = null;
      return;
    }
    if (nearBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages, open]);

  function onScroll() {
    const el = scrollRef.current;
    if (el) nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight <= 40;
  }

  async function send() {
    const body = draft.trim();
    if (sending) return;
    if (!body) return push(friendlyError(new Error("EMPTY_MESSAGE")), "error");
    setSending(true);
    const { data, error } = await createClient().rpc("post_chat_message", { p_channel_slug: slug, p_body: body });
    setSending(false);
    if (error) return push(friendlyError(error), "error");
    nearBottom.current = true;
    setMessages((cur) => mergeMessages(cur, [data as ChatMessage]));
    setDraft("");
    inputRef.current?.focus();
  }

  async function remove(id: string) {
    const { error } = await createClient().rpc("delete_chat_message", { p_id: id });
    if (error) return push(friendlyError(error), "error");
    setMessages((cur) => cur.filter((m) => m.id !== id));
  }

  async function loadEarlier() {
    const oldest = messages[0];
    if (!oldest || loadingEarlier) return;
    setLoadingEarlier(true);
    const { data, error } = await createClient().rpc("chat_recent", { p_channel: channelId, p_limit: CHAT_PAGE, p_before: oldest.created_at });
    setLoadingEarlier(false);
    if (error) return push(friendlyError(error), "error");
    const rows = data ?? [];
    if (rows.length < CHAT_PAGE) setHasEarlier(false);
    if (rows.length === 0) return;
    prependHeight.current = scrollRef.current?.scrollHeight ?? null;
    setMessages((cur) => mergeMessages(cur, rows));
  }

  return (
    <>
      <button
        type="button"
        aria-label={open ? "Close chat" : "Open chat"}
        aria-expanded={open}
        onClick={toggle}
        className="fixed bottom-[25px] z-40 flex h-[46px] items-center justify-center gap-[12px] whitespace-nowrap rounded-[23px] border border-card-stroke-2 bg-chat px-[24px] text-white max-lg:inset-x-[24px] lg:right-[24px] lg:min-w-[242px]"
      >
        <i className="fa-solid fa-comments text-[20px]" aria-hidden="true" />
        <span className="inline-block h-[14px] w-[14px] rounded-full bg-green" aria-hidden="true" />
        <span className="mono text-[16px] tracking-[0.01em]" aria-label="Fans online">{onlineLabel(online)}</span>
      </button>
      {open && (
        <section
          role="dialog"
          aria-label="Chat"
          className="fixed z-50 flex flex-col overflow-hidden rounded-[15.5px] border border-card-stroke-2 bg-chat text-white max-lg:inset-x-[24px] max-lg:bottom-[85px] max-lg:top-[16px] lg:bottom-[85px] lg:right-[24px] lg:h-[min(600px,calc(100vh_-_110px))] lg:w-[400px]"
        >
          <header className="flex h-[64px] shrink-0 items-center gap-[12px] border-b border-hairline px-[24px]">
            <h2 className="text-[24px] leading-none">Chat</h2>
            <span className="ml-[12px] inline-block h-[14px] w-[14px] rounded-full bg-green" aria-hidden="true" />
            <span className="mono text-[14px] leading-none">{onlineLabel(online)}</span>
            <button type="button" aria-label="Close chat" className="ml-auto -mr-[6px]" onClick={close}><i className="mi-round text-[32px] text-muted" aria-hidden="true">cancel</i></button>
          </header>
          <div ref={scrollRef} onScroll={onScroll} className="scrollbar-none flex-1 overflow-y-auto px-[16px]">
            {hasEarlier && (
              <div className="flex justify-center pt-[12px]">
                <button type="button" className="text-[14px] leading-none text-muted hover:text-white" onClick={loadEarlier} disabled={loadingEarlier}>{loadingEarlier ? "Loading…" : "Load earlier"}</button>
              </div>
            )}
            {messages.length === 0 && <p className="py-[20px] text-[16px] text-muted">No messages yet. Say hi.</p>}
            <ul aria-label="Messages" className="min-h-[24px]">
              {messages.map((m) => {
                const mine = viewer?.id === m.fan_id;
                return (
                  <li key={m.id} className="flex gap-[12px] py-[12px]">
                    <span className="fan-avatar" aria-hidden="true"><i className="fa-solid fa-user-astronaut text-[20px]" /><i className="fa-solid fa-flag fan-flag" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-[8px]">
                        <span className={`truncate text-[16px] leading-none ${mine ? "text-yellow" : ""}`}>{m.display_name}</span>
                        {m.is_admin && <span className="mono inline-flex h-[20px] shrink-0 items-center rounded-[7.5px] border border-accent bg-section-dark px-[8px] text-[12px] uppercase leading-none">Band</span>}
                        <span className="shrink-0 text-[14px] leading-none text-muted">{timeAgo(m.created_at, n)}</span>
                        {viewer && (mine || isAdmin) && (
                          <button type="button" aria-label="Delete message" className="ml-auto shrink-0 text-[14px] leading-none text-muted hover:text-white" onClick={() => remove(m.id)}>Delete</button>
                        )}
                      </span>
                      <span className="mt-[6px] block text-[16px] leading-[22px] text-white [overflow-wrap:anywhere]">{m.body}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
          {viewer ? (
            <form className="shrink-0 border-t border-hairline p-[16px]" onSubmit={(e) => { e.preventDefault(); void send(); }}>
              <div className="flex gap-[12px]">
                <input
                  ref={inputRef}
                  aria-label="Message"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  maxLength={CHAT_MAX}
                  placeholder="Say something to the band"
                  autoComplete="off"
                  className="h-[48px] min-w-0 flex-1 rounded-[8px] border border-card-stroke-2 bg-card px-[16px] text-[16px] text-white outline-none placeholder:text-muted focus:border-white"
                />
                <button type="submit" aria-label="Send" disabled={sending} className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-[8px] bg-yellow text-black disabled:opacity-60">
                  <i className="fa-solid fa-paper-plane text-[18px]" aria-hidden="true" />
                </button>
              </div>
              {draft.length > 400 && <p className="mono mt-[6px] text-[12px] leading-none text-muted">{draft.length}/{CHAT_MAX}</p>}
            </form>
          ) : (
            <div className="shrink-0 border-t border-hairline p-[16px]">
              <button type="button" className="fig-btn fig-btn-yellow" onClick={() => openJoin(`/${slug}`)}>Sign in to chat</button>
            </div>
          )}
        </section>
      )}
    </>
  );
}
