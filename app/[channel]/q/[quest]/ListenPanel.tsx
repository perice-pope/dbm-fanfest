"use client";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { connectListenBrainz, disconnectListening, syncListens } from "@/app/[channel]/listen-actions";
import { useToast } from "@/components/Toast";
import { friendlyError } from "@/lib/errors";
import { timeAgo } from "@/lib/format";

type Account = { service: string; username: string; display_name: string | null; connected_at: string; last_synced_at: string | null } | null;
type Props = { slug: string; questId: string; account: Account; today: number; cap: number; xp: number; anyXp: number; anyCap: number; spotifyReady: boolean; lastfmReady: boolean };

const LB = "https://listenbrainz.org";
const LFM = "https://www.last.fm";
const SP = "https://open.spotify.com";
const TICK_MS = 60_000;

/** Link Spotify (one tap, the EJAE flow), Last.fm (one click) or ListenBrainz (paste a token), then plays are checked on load and every minute. */
export function ListenPanel({ slug, questId, account, today, cap, xp, anyXp, anyCap, spotifyReady, lastfmReady }: Props) {
  const [token, setToken] = useState("");
  const oneClick = spotifyReady || lastfmReady;
  const [showLb, setShowLb] = useState(!oneClick);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const { push } = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const announced = useRef(false);

  // Outcome of the Spotify or Last.fm round trip lands here as ?spotify=connected, ?lastfm=connected or ?<service>_error=CODE.
  useEffect(() => {
    if (announced.current) return;
    const ok = params.get("spotify") ? "Spotify" : params.get("lastfm") ? "Last.fm" : null;
    const err = params.get("spotify_error") ?? params.get("lastfm_error");
    if (!ok && !err) return;
    announced.current = true;
    if (ok) push(`${ok} connected. Your plays now earn XP.`, "info");
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
      else if (!quiet) push(r.data.capped ? "Daily limit reached. Come back tomorrow." : "No new plays yet. A song counts once it finishes playing.", "info");
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
        {spotifyReady && (
          <>
            <p className="text-sm">Connect Spotify once. Everything you play after that counts, nothing else to set up.</p>
            <a href={`/api/spotify/connect?slug=${slug}&quest=${questId}`} className="btn btn-primary w-full">Connect Spotify</a>
          </>
        )}
        {lastfmReady && (
          <div className={spotifyReady ? "space-y-2 border-t border-hairline pt-4" : "space-y-4"}>
            <p className="text-sm">{spotifyReady ? "Not on Spotify? " : ""}Last.fm records what you play on Tidal, Deezer, YouTube and most desktop players.</p>
            <a href={`/api/lastfm/connect?slug=${slug}&quest=${questId}`} className={`btn w-full ${spotifyReady ? "btn-ghost" : "btn-primary"}`}>Connect Last.fm</a>
            <p className="text-xs text-muted">No Last.fm yet? <a className="underline" href={`${LFM}/join`} target="_blank" rel="noopener noreferrer">Create a free account</a>, then link your player under <a className="underline" href={`${LFM}/settings/applications`} target="_blank" rel="noopener noreferrer">Settings → Applications</a>.</p>
          </div>
        )}
        {oneClick && error && <p className="text-sm text-danger">{error}</p>}
        {oneClick && <button type="button" className="text-xs text-muted underline" onClick={() => setShowLb((v) => !v)}>{showLb ? "Hide ListenBrainz option" : "Use ListenBrainz instead"}</button>}
        {showLb && (
          <form
            className={`space-y-3 ${oneClick ? "border-t border-hairline pt-4" : ""}`}
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
            {!oneClick && error && <p className="text-sm text-danger">{error}</p>}
            <button type="submit" className="btn btn-primary w-full" disabled={pending || !token.trim()}>{pending ? "Checking…" : "Connect ListenBrainz"}</button>
          </form>
        )}
        <p className="text-xs text-muted">Apple Music and Amazon Music plays cannot be tracked yet.</p>
      </div>
    );
  }

  const isSp = account.service === "spotify";
  const isLfm = account.service === "lastfm";
  const profile = isSp ? `${SP}/user/${encodeURIComponent(account.username)}` : isLfm ? `${LFM}/user/${encodeURIComponent(account.username)}` : `${LB}/user/${encodeURIComponent(account.username)}/`;
  const label = isSp ? "Spotify" : isLfm ? "Last.fm" : "ListenBrainz";
  return (
    <div className="card space-y-4 p-5">
      <p className="text-sm">{label} connected as <a className="underline" href={profile} target="_blank" rel="noopener noreferrer">{account.display_name || account.username}</a>
        <span className="text-muted"> · {checkedLabel(account.last_synced_at)}</span></p>
      <p className="text-sm"><span className="mono text-[20px]">{today}/{cap}</span> of our songs credited today · {xp.toLocaleString()} XP each{anyXp > 0 && <span className="text-muted"> · other plays {anyXp} XP, up to {anyCap} a day</span>}</p>
      {error && <p className="text-sm text-danger">{error}</p>}
      <button type="button" className="btn btn-primary w-full" disabled={pending} onClick={() => check(false)}>{pending ? "Checking…" : "Check my plays"}</button>
      <button type="button" className="btn btn-ghost w-full text-sm" disabled={pending} onClick={() => start(async () => { const r = await disconnectListening(slug, questId); if (!r.ok) return setError(r.error); router.refresh(); })}>Disconnect</button>
      <p className="text-xs text-muted">Checks run on their own every minute while this page is open. {isSp ? <>Reads your recent plays from Spotify; nothing is posted.</> : isLfm ? <>Powered by <a className="underline" href={LFM} target="_blank" rel="noopener noreferrer">AudioScrobbler</a> / Last.fm.</> : <>Listening data from <a className="underline" href={LB} target="_blank" rel="noopener noreferrer">ListenBrainz</a>.</>}</p>
    </div>
  );
}

function checkedLabel(at: string | null) {
  if (!at) return "not checked yet";
  const ago = timeAgo(at);
  return ago === "now" ? "checked just now" : `checked ${ago} ago`;
}
