"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";

type Ctx = { open: (next?: string) => void };
const JoinCtx = createContext<Ctx>({ open: () => {} });
export function useJoin() { return useContext(JoinCtx); }

/** "Join or Sign In" modal from the Figma Modals page. Opens when a visitor taps anything that earns XP. */
export function JoinModalProvider({ children, slug, name, avatar }: { children: React.ReactNode; slug: string; name: string; avatar: string | null }) {
  const [next, setNext] = useState<string | null>(null);
  const open = useCallback((n?: string) => setNext(n ?? `/${slug}`), [slug]);
  const close = () => setNext(null);
  useEffect(() => {
    if (next == null) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next]);
  const q = next ? `?next=${encodeURIComponent(next)}` : "";
  return (
    <JoinCtx.Provider value={{ open }}>
      {children}
      {next != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={close} role="presentation">
          <div role="dialog" aria-modal="true" aria-labelledby="join-title" className="relative w-[554px] max-w-full rounded-[15.5px] border border-card-stroke-2 bg-chat p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <h2 id="join-title" className="text-[32px] leading-none">Join or Sign In</h2>
              <button type="button" aria-label="Close" className="mi-round -mr-1 -mt-1 text-[32px] text-muted" onClick={close}>cancel</button>
            </div>
            <div className="mt-[26px] flex items-center gap-[25px]">
              <span className="relative block h-[89px] w-[89px] shrink-0 overflow-hidden rounded-[7.5px] border border-muted bg-section-dark">
                {avatar && <Image src={avatar} alt="" fill className="object-cover object-[50%_19%]" sizes="89px" />}
              </span>
              <p className="text-[24px] leading-tight">Join {name} FanFest</p>
            </div>
            <p className="mt-[28px] text-[16px] leading-none">Earn XP, climb the leaderboard, unlock rewards.</p>
            <Link href={`/${slug}/sign-in${q}${q ? "&" : "?"}mode=signup`} className="fig-btn fig-btn-yellow mt-[21px]" onClick={close}>Sign Up</Link>
            <p className="mt-[32px] text-[16px] leading-none">Already a member?</p>
            <Link href={`/${slug}/sign-in${q}`} className="fig-btn fig-btn-yellow-outline mt-[21px]" onClick={close}>Sign In</Link>
            <p className="mt-[34px] text-[16px] leading-none">By signing up you agree to the <Link href={`/${slug}/privacy`} className="text-muted" onClick={close}>Terms</Link> and <Link href={`/${slug}/privacy`} className="text-muted" onClick={close}>Privacy</Link>.</p>
          </div>
        </div>
      )}
    </JoinCtx.Provider>
  );
}

/** A link that works for fans and opens the join modal for visitors. */
export function GatedLink({ href, signedIn, className, children, ariaLabel }: { href: string; signedIn: boolean; className?: string; children: React.ReactNode; ariaLabel?: string }) {
  const { open } = useJoin();
  if (signedIn) return <Link href={href} className={className} aria-label={ariaLabel}>{children}</Link>;
  return <button type="button" className={className} aria-label={ariaLabel} onClick={() => open(href)}>{children}</button>;
}
