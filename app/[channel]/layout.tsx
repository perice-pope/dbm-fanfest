import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getChannel, getViewer, isAdminOf, settingsOf } from "@/lib/data";
import { getChannelFigures, compact, linksOf } from "@/lib/channel-view";
import { ToastProvider, XpFromQuery } from "@/components/Toast";
import { JoinModalProvider } from "@/components/JoinModal";
import { StatusBar } from "@/components/StatusBar";
import { BottomNav, SocialRow, navItems } from "@/components/BottomNav";
import { Chat } from "@/components/Chat";
import { createClient } from "@/lib/supabase/server";
import { CHAT_PAGE, type ChatMessage } from "@/lib/chat";
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
  const sb = await createClient();
  const [admin, figures, chat] = await Promise.all([
    fan ? isAdminOf(channel.id) : Promise.resolve(false),
    getChannelFigures(channel, sb),
    sb.rpc("chat_recent", { p_channel: channel.id, p_limit: CHAT_PAGE }),
  ]);
  const settings = settingsOf(channel);
  const links = linksOf(channel);
  const theme = settings.theme ?? {};
  const style = {
    ...(theme.accent ? { "--accent": theme.accent, "--band": theme.accent, "--bg-top": theme.accent } : {}),
    ...(theme.bg ? { "--bg-bottom": theme.bg, "--section-dark": theme.bg } : {}),
  } as React.CSSProperties;
  const hero = channel.hero_url || "/dbm/banner.png";
  const logo = channel.logo_url || "/dbm/logo.png";
  const avatar = settings.avatar_url || "/dbm/avatar.jpg";
  const nav = navItems(slug, links);
  const signInHref = `/${slug}/sign-in`;

  return (
    <ToastProvider>
      <JoinModalProvider slug={slug} name={channel.name} avatar={avatar}>
        <div style={style} className="flex min-h-full flex-1 flex-col pb-[96px] text-white">
          <StatusBar />
          {/* Nav band: logo centred, page links left on desktop, social icons right on desktop and under the logo on phones */}
          <div className="bg-band">
            <div className="relative mx-auto h-[152px] max-w-[1440px] lg:h-[150px]">
              <ul className="absolute left-[133px] top-[110px] hidden items-center gap-[32px] text-[16px] leading-none tracking-[0.5px] lg:flex" aria-label="Pages">
                {nav.map((it) => <li key={it.label}>{it.external ? <a href={it.href}>{it.label}</a> : <Link href={it.href}>{it.label}</Link>}</li>)}
              </ul>
              <Link href={`/${slug}`} className="absolute left-1/2 top-[24px] -translate-x-1/2" aria-label={channel.name}>
                <Image src={logo} alt={channel.name} width={510} height={102} priority className="h-[40px] w-[200px] object-cover object-center lg:h-[102px] lg:w-[510px]" />
              </Link>
              <SocialRow links={links as Record<string, string | null | undefined>} className="absolute max-lg:left-1/2 max-lg:top-[66px] max-lg:-translate-x-1/2 lg:right-[148px] lg:top-[112px]" />
            </div>
          </div>
          {/* Banner header */}
          <header className="relative h-[400px] overflow-hidden lg:h-[480px]">
            <Image src={hero} alt="" fill priority sizes="100vw" className="object-cover object-center" />
            <div className="relative mx-auto h-full max-w-[1440px]">
              {fan ? (
                <div className="absolute right-[24px] top-[24px] flex items-center gap-[12px] max-lg:gap-[8px]">
                  <Link href={`/${slug}/account`} className="fig-btn-sm fig-btn-sm-ghost max-w-[140px] truncate px-[16px] max-lg:h-[36px] max-lg:px-[12px] max-lg:text-[14px]">{fan.display_name ?? "Account"}</Link>
                  {admin && <Link href={`/${slug}/admin`} className="fig-btn-sm fig-btn-sm-ghost px-[16px] max-lg:h-[36px] max-lg:px-[12px] max-lg:text-[14px]">Admin</Link>}
                  <form action={signOut.bind(null, slug)}><button type="submit" className="fig-btn-sm fig-btn-sm-white px-[16px] max-lg:h-[36px] max-lg:px-[12px] max-lg:text-[14px]">Sign Out</button></form>
                </div>
              ) : (
                <div className="absolute inset-x-[24px] top-[24px] grid grid-cols-2 gap-[24px] lg:inset-x-auto lg:right-[24px] lg:flex lg:gap-[28px]">
                  <Link href={`${signInHref}?mode=signup`} className="fig-btn-sm fig-btn-sm-ghost lg:w-[94px]">Sign Up</Link>
                  <Link href={signInHref} className="fig-btn-sm fig-btn-sm-white lg:w-[94px]">Sign In</Link>
                </div>
              )}
              <div className="absolute bottom-[21px] left-[24px] hidden h-[99px] w-[99px] overflow-hidden rounded-[7.5px] border border-muted bg-section-dark lg:block">
                <Image src={avatar} alt="" fill sizes="99px" className="object-cover object-[50%_19%]" />
              </div>
              {/* Desktop: title + stats row beside the avatar. Phone: stacked block. */}
              <div className="absolute bottom-[27px] left-[139px] hidden lg:block">
                <h1 className="text-[48px] leading-none">{channel.name}</h1>
                <div className="mt-[18px] flex items-center gap-[24px]">
                  <span className="flex items-center">
                    <span className="flex" aria-hidden="true">
                      {[0, 1, 2].map((i) => <span key={i} className="avatar-icon -ml-[2px] first:ml-0"><i className="fa-solid fa-user-astronaut text-[16px]" /></span>)}
                    </span>
                    <span className="mono ml-[14px] text-[14px] leading-none">{fmtInt(figures.fans)} USERS</span>
                  </span>
                  <span className="flex items-center gap-[8px]"><i className="fa-solid fa-star text-[16px]" aria-hidden="true" /><span className="mono text-[16px] leading-none">{compact(figures.lifetimeXp)}</span></span>
                  <span className="flex items-center gap-[8px]"><span className="inline-block h-[14px] w-[14px] rounded-full bg-green" aria-hidden="true" /><span className="mono text-[16px] leading-none" aria-label="Fans online">{figures.online} FAN{figures.online === 1 ? "" : "S"} ONLINE</span></span>
                </div>
              </div>
              <div className="absolute bottom-[16px] left-[24px] lg:hidden">
                <h1 className="text-[32px] leading-none">{channel.name}</h1>
                <p className="mt-[20px] flex items-center gap-[10px]"><span className="inline-block h-[14px] w-[14px] rounded-full bg-green" aria-hidden="true" /><span className="mono text-[16px] leading-none" aria-label="Fans online">{figures.online} FAN{figures.online === 1 ? "" : "S"} ONLINE</span></p>
                <p className="mt-[14px] flex items-center">
                  <span className="flex" aria-hidden="true">{[0, 1, 2].map((i) => <span key={i} className="avatar-icon -ml-[2px] first:ml-0" style={{ width: 20, height: 20 }}><i className="fa-solid fa-user-astronaut text-[12px]" /></span>)}</span>
                  <span className="mono ml-[12px] text-[16px] leading-none">{fmtInt(figures.fans)} USERS</span>
                </p>
                <p className="mt-[12px] flex items-center gap-[8px]"><i className="fa-solid fa-star text-[16px]" aria-hidden="true" /><span className="mono text-[16px] leading-none">{compact(figures.lifetimeXp)}</span></p>
              </div>
            </div>
          </header>
          <main className="flex-1">{children}</main>
          <BottomNav items={nav} />
          <footer className="mx-auto mt-[24px] flex max-w-[1440px] flex-wrap items-center gap-x-[20px] gap-y-2 px-[24px] text-[13px] text-white/60">
            <Link href={`/${slug}/privacy`} className="hover:text-white">Privacy</Link>
            {fan && <Link href={`/${slug}/account`} className="hover:text-white">Account</Link>}
            {admin && <Link href={`/${slug}/admin`} className="hover:text-white">Admin</Link>}
          </footer>
          <Chat slug={slug} channelId={channel.id} online={figures.online} initial={(chat.data ?? []) as ChatMessage[]} viewer={fan ? { id: fan.id, name: fan.display_name } : null} isAdmin={admin} now={new Date().toISOString()} />
        </div>
        <XpFromQuery />
      </JoinModalProvider>
    </ToastProvider>
  );
}

function fmtInt(n: number) {
  return new Intl.NumberFormat("en-US").format(n);
}
