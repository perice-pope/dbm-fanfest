"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { connectListenBrainz, disconnectListenBrainz, syncListens } from "@/app/[channel]/listen-actions";
import { useToast } from "@/components/Toast";
import { timeAgo } from "@/lib/format";

type Account = { username: string; connected_at: string; last_synced_at: string | null } | null;

const LB = "https://listenbrainz.org";

/** Connect a ListenBrainz account by pasting its user token, then check for new plays of the band's songs. */
export function ListenPanel({ slug, questId, account, today, cap, xp }: { slug: string; questId: string; account: Account; today: number; cap: number; xp: number }) {
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const { push } = useToast();
  const router = useRouter();

  if (!account) {
    return (
      <form
        className="card space-y-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          start(async () => {
            const r = await connectListenBrainz(slug, questId, token);
            if (!r.ok) return setError(r.error);
            setToken("");
            push(`Connected as ${r.data.username}. Plays count from now.`, "info");
            router.refresh();
          });
        }}
      >
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          <li>Make a free account at <a className="underline" href={`${LB}/login/`} target="_blank" rel="noopener noreferrer">ListenBrainz</a>.</li>
          <li>In its <a className="underline" href={`${LB}/settings/music-services/details/`} target="_blank" rel="noopener noreferrer">Connect services</a> settings, link Spotify, or link Last.fm if you stream on Tidal, Deezer or YouTube.</li>
          <li>Copy your user token from <a className="underline" href={`${LB}/settings/`} target="_blank" rel="noopener noreferrer">ListenBrainz settings</a> and paste it here. We only use it to confirm the account is yours, then throw it away.</li>
        </ol>
        <label className="block text-sm">ListenBrainz user token
          <input aria-label="ListenBrainz user token" className="input mt-1 font-mono text-sm" value={token} onChange={(e) => setToken(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" autoComplete="off" spellCheck={false} required />
        </label>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button type="submit" className="btn btn-primary w-full" disabled={pending || !token.trim()}>{pending ? "Checking…" : "Connect ListenBrainz"}</button>
        <p className="text-xs text-muted">Apple Music and Amazon Music plays cannot reach ListenBrainz yet.</p>
      </form>
    );
  }

  return (
    <div className="card space-y-4 p-5">
      <p className="text-sm">Connected as <a className="underline" href={`${LB}/user/${encodeURIComponent(account.username)}/`} target="_blank" rel="noopener noreferrer">{account.username}</a>
        <span className="text-muted"> · {checkedLabel(account.last_synced_at)}</span></p>
      <p className="text-sm"><span className="mono text-[20px]">{today}/{cap}</span> songs credited today · {xp.toLocaleString()} XP each</p>
      {error && <p className="text-sm text-danger">{error}</p>}
      <button
        type="button"
        className="btn btn-primary w-full"
        disabled={pending}
        onClick={() => {
          setError(null);
          start(async () => {
            const r = await syncListens(slug, questId);
            if (!r.ok) return setError(r.error);
            if (r.data.awarded) push(`+${r.data.xp.toLocaleString()} XP · ${r.data.awarded} song${r.data.awarded === 1 ? "" : "s"}`, "xp");
            else push(r.data.capped ? "Daily limit reached. Come back tomorrow." : "No new plays yet. Plays can take a few minutes to reach ListenBrainz.", "info");
            router.refresh();
          });
        }}
      >{pending ? "Checking…" : "Check my plays"}</button>
      <button
        type="button"
        className="btn btn-ghost w-full text-sm"
        disabled={pending}
        onClick={() => start(async () => {
          const r = await disconnectListenBrainz(slug, questId);
          if (!r.ok) return setError(r.error);
          router.refresh();
        })}
      >Disconnect</button>
      <p className="text-xs text-muted">Listening data from <a className="underline" href={LB} target="_blank" rel="noopener noreferrer">ListenBrainz</a>. Plays also sync once a day on their own.</p>
    </div>
  );
}

function checkedLabel(at: string | null) {
  if (!at) return "not checked yet";
  const ago = timeAgo(at);
  return ago === "now" ? "checked just now" : `checked ${ago} ago`;
}
