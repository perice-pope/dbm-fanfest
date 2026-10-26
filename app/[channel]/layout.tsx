import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getChannel, getViewer, isAdminOf, settingsOf } from "@/lib/data";
import { ToastProvider, XpFromQuery } from "@/components/Toast";
import { signOut } from "@/app/[channel]/actions";

export async function generateMetadata({ params }: { params: Promise<{ channel: string }> }): Promise<Metadata> {
  const { channel } = await params;
  const ch = await getChannel(channel);
  return { title: ch ? `${ch.name} ·` : "FanFest", description: ch?.tagline ?? undefined };
}

export default async function ChannelLayout({ children, params }: { children: React.ReactNode; params: Promise<{ channel: string }> }) {
  const { channel: slug } = await params;
  const channel = await getChannel(slug);
  if (!channel) notFound();
  const { fan } = await getViewer();
  const admin = fan ? await isAdminOf(channel.id) : false;
  const theme = settingsOf(channel).theme ?? {};
  const style = {
    ...(theme.accent ? { "--accent": theme.accent } : {}),
    ...(theme.bg ? { "--bg": theme.bg } : {}),
    ...(theme.surface ? { "--surface": theme.surface } : {}),
    ...(theme.text ? { "--text": theme.text } : {}),
  } as React.CSSProperties;

  return (
    <ToastProvider>
      <div style={style} className="flex min-h-full flex-1 flex-col bg-bg text-text">
        <header className="mx-auto w-full max-w-6xl px-4 pt-5 sm:pt-8">
          <div className="flex items-start justify-between gap-4">
            <Link href={`/${slug}`} className="min-w-0">
              <h1 className="display text-4xl leading-[0.9] sm:text-6xl">{channel.name}</h1>
              {channel.tagline && <p className="mt-1 text-sm text-muted">{channel.tagline}</p>}
            </Link>
            <div className="flex shrink-0 items-center gap-2">
              {fan ? (
                <Link href={`/${slug}/account`} className="flex items-center gap-2 rounded-full border border-line bg-surface py-1.5 pl-1.5 pr-3 text-sm hover:bg-surface-2" aria-label="Account">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-bold uppercase text-accent-ink">{(fan.display_name ?? fan.email).slice(0, 1)}</span>
                  <span className="max-w-[9rem] truncate">{fan.display_name ?? "Set your name"}</span>
                </Link>
              ) : (
                <>
                  <Link href={`/${slug}/sign-in?mode=signup`} className="btn btn-primary px-3 text-base">Sign up</Link>
                  <Link href={`/${slug}/sign-in`} className="btn btn-secondary px-3 text-base">Sign in</Link>
                </>
              )}
            </div>
          </div>
          {!fan && <p className="mt-3 text-xs uppercase tracking-[0.14em] text-muted">Browsing anonymously</p>}
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 sm:py-8">{children}</main>
        <footer className="mx-auto w-full max-w-6xl px-4 pb-10 pt-6 text-xs text-muted">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-5">
            <Link href={`/${slug}/privacy`} className="hover:text-text">Privacy settings</Link>
            {fan && <Link href={`/${slug}/account`} className="hover:text-text">Account</Link>}
            {admin && <Link href={`/${slug}/admin`} className="hover:text-text">Admin</Link>}
            {settingsOf(channel).chat_url && <a href={settingsOf(channel).chat_url} className="hover:text-text">Chat</a>}
            {fan && (
              <form action={signOut.bind(null, slug)}><button type="submit" className="hover:text-text">Sign out</button></form>
            )}
            <span className="ml-auto">FanFest</span>
          </div>
        </footer>
      </div>
      <XpFromQuery />
    </ToastProvider>
  );
}
