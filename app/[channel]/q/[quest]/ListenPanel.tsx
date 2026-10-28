"use client";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { connectListenBrainz, disconnectListening, syncListens } from "@/app/[channel]/listen-actions";
import { useToast } from "@/components/Toast";
import { friendlyError } from "@/lib/errors";
import { timeAgo } from "@/lib/format";

type Account = { service: string; username: string; connected_at: string; last_synced_at: string | null } | null;
type Props = { slug: string; questId: string; account: Account; today: number; cap: number; xp: number; anyXp: number; anyCap: number; lastfmReady: boolean };

const LB = "https://listenbrainz.org";
const LFM = "https://www.last.fm";
const TICK_MS = 60_000;

/** Link Last.fm (one click, like the EJAE Spotify card) or ListenBrainz (paste a token), then plays are checked on load and every minute. */
export function ListenPanel({ slug, questId, account, today, cap, xp, anyXp, anyCap, lastfmReady }: Props) {
  const [token, setToken] = useState("");
  const [showLb, setShowLb] = useState(!lastfmReady);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const { push } = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const announced = useRef(false);

  // Outcome of the Last.fm round trip lands here as ?lastfm=connected or ?lastfm_error=CODE.
  useEffect(() => {
    if (announced.current) return;
    const ok = params.get("lastfm");
    const err = params.get("lastfm_error");
    if (!ok && !err) return;
    announced.current = true;
    if (ok) push("Last.fm connected. Your plays now earn XP.", "info");
    else push(friendlyError(new Error(err!)), "error");
    router.replace(`/${slug}/q/${questId}`);
  }, [params, push, router, slug, questId]);

  const check = useCallback((quiet: boolean) => {
    start(async () => {
      const r = await syncListens(slug, questId);
      if (!r.ok) { if (!quiet || r.error.includes("hidden")) setError(r.error); return; }
      setError(null);
      const songs = r.data.awarded;
      if (r.data.xp > 0) push(`+${r.data.xp.toLocaleString()} XP · ${songs ? `${songs} of our song${songs === 1 ? "" : "s"}` : "streaming"}`, "xp");
      else if (!quiet) push(r.data.capped ? "Daily limit reached. Come back tomorrow." : "No new plays yet. Plays can take a minute to reach Last.fm.", "info");
      if (r.data.xp > 0) router.refresh();
    });
  }, [slug, questId, push, router]);

  // Like the EJAE site: scan on load and once a minute while the page is open, so XP appears while you listen.
  useEffect(() => {
    if (!account) return;
    const stale = !account.last_synced_at || Date.now() - new Date(account.last_synced_at).getTime() > TICK_MS;
    if (stale) check(true);
    const t = setInterval(() => { if (!document.hidden) check(true); }, TICK_MS);
    return () => clearInterval(t);
  }, [account, check]);

  if (!account) {
    return (
      <div className="card space-y-4 p-5">
        {lastfmReady && (
          <>
            <p className="text-sm">Last.fm records what you play on Spotify, Tidal, Deezer, YouTube and more. Link it once and every play counts.</p>
            <a href={`/api/lastfm/connect?slug=${slug}&quest=${questId}`} className="btn btn-primary w-full">Connect Last.fm</a>
            <p className="text-xs text-muted">No Last.fm yet? <a className="underline" href={`${LFM}/join`} target="_blank" rel="noopener noreferrer">Create a free account</a>, then connect your streaming app under <a className="underline" href={`${LFM}/settings/applications`} target="_blank" rel="noopener noreferrer">Settings → Applications</a>.</p>
            {error && <p className="text-sm text-danger">{error}</p>}
            <button type="button" className="text-xs text-muted underline" onClick={() => setShowLb((v) => !v)}>{showLb ? "Hide ListenBrainz option" : "Use ListenBrainz instead"}</button>
          </>
        )}
        {showLb && (
          <form
            className="space-y-3 border-t border-hairline pt-4"
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
              <li>Make a free account at <a className="underline" href={`${LB}/login/`} target="_blank" rel="noopener noreferrer">ListenBrainz</a> and link Spotify or Last.fm under <a className="underline" href={`${LB}/settings/music-services/details/`} target="_blank" rel="noopener noreferrer">Connect services</a>.</li>
              <li>Copy your user token from <a className="underline" href={`${LB}/settings/`} target="_blank" rel="noopener noreferrer">ListenBrainz settings</a> and paste it here. We only use it to confirm the account is yours.</li>
            </ol>
            <label className="block text-sm">ListenBrainz user token
              <input aria-label="ListenBrainz user token" className="input mt-1 font-mono text-sm" value={token} onChange={(e) => setToken(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" autoComplete="off" spellCheck={false} required />
            </label>
            {!lastfmReady && error && <p className="text-sm text-danger">{error}</p>}
            <button type="submit" className="btn btn-primary w-full" disabled={pending || !token.trim()}>{pending ? "Checking…" : "Connect ListenBrainz"}</button>
          </form>
        )}
        <p className="text-xs text-muted">Apple Music and Amazon Music plays cannot be tracked yet.</p>
      </div>
    );
  }

  const isLfm = account.service === "lastfm";
  const profile = isLfm ? `${LFM}/user/${encodeURIComponent(account.username)}` : `${LB}/user/${encodeURIComponent(account.username)}/`;
  return (
    <div className="card space-y-4 p-5">
      <p className="text-sm">{isLfm ? "Last.fm" : "ListenBrainz"} connected as <a className="underline" href={profile} target="_blank" rel="noopener noreferrer">{account.username}</a>
        <span className="text-muted"> · {checkedLabel(account.last_synced_at)}</span></p>
      <p className="text-sm"><span className="mono text-[20px]">{today}/{cap}</span> of our songs credited today · {xp.toLocaleString()} XP each{anyXp > 0 && <span className="text-muted"> · other plays {anyXp} XP, up to {anyCap} a day</span>}</p>
      {error && <p className="text-sm text-danger">{error}</p>}
      <button type="button" className="btn btn-primary w-full" disabled={pending} onClick={() => check(false)}>{pending ? "Checking…" : "Check my plays"}</button>
      <button type="button" className="btn btn-ghost w-full text-sm" disabled={pending} onClick={() => start(async () => { const r = await disconnectListening(slug, questId); if (!r.ok) return setError(r.error); router.refresh(); })}>Disconnect</button>
      <p className="text-xs text-muted">Checks run on their own every minute while this page is open. {isLfm ? <>Powered by <a className="underline" href={LFM} target="_blank" rel="noopener noreferrer">AudioScrobbler</a> / Last.fm.</> : <>Listening data from <a className="underline" href={LB} target="_blank" rel="noopener noreferrer">ListenBrainz</a>.</>}</p>
    </div>
  );
}

function checkedLabel(at: string | null) {
  if (!at) return "not checked yet";
  const ago = timeAgo(at);
  return ago === "now" ? "checked just now" : `checked ${ago} ago`;
}
