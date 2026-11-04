import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getChannel, getViewer, isAdminOf, settingsOf } from "@/lib/data";
import { linksOf } from "@/lib/channel-view";
import { ToastProvider, XpFromQuery } from "@/components/Toast";
import { JoinModalProvider } from "@/components/JoinModal";
import { StatusBar } from "@/components/StatusBar";
import { BottomNav, NavLink, SocialRow, navItems } from "@/components/BottomNav";
import { fanfestUrl, merchUrl } from "@/lib/site";
import { signOut } from "@/app/[channel]/actions";

export async function generateMetadata({ params }: { params: Promise<{ channel: string }> }): Promise<Metadata> {
  const { channel } = await params;
  const ch = await getChannel(channel);
  if (!ch) return { title: "Destroyed by Moths" };
  return { title: { default: ch.name, template: `%s · ${ch.name}` }, description: `${ch.name}: news, shows, merch and the fan community.` };
}

/**
 * The band site's shell from the Figma: nav band with logo, page links and socials, then the banner header.
 * The fan club (quests, leaderboard, rewards, chat, sign-in) now lives on FanFest behind the Community link, so visitors
 * see no sign-in buttons or fan counters here. Signed-in fans and admins keep their Account and Admin buttons.
 */
export default async function ChannelLayout({ children, params }: { children: React.ReactNode; params: Promise<{ channel: string }> }) {
  const { channel: slug } = await params;
  const channel = await getChannel(slug);
  if (!channel) notFound();
  const { fan } = await getViewer();
  const admin = fan ? await isAdminOf(channel.id) : false;
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
  const nav = navItems(slug, { merchUrl: merchUrl(), communityUrl: fanfestUrl() });

  return (
    <ToastProvider>
      <JoinModalProvider slug={slug} name={channel.name} avatar={avatar}>
        <div style={style} className="flex min-h-full flex-1 flex-col pb-[96px] text-white">
          <StatusBar />
          {/* Nav band: logo centred, page links left on desktop, social icons right on desktop and under the logo on phones */}
          <div className="bg-band">
            <div className="relative mx-auto h-[152px] max-w-[1440px] lg:h-[150px]">
              <ul className="absolute left-[133px] top-[110px] hidden items-center gap-[32px] text-[16px] leading-none tracking-[0.5px] lg:flex" aria-label="Pages">
                {nav.map((it) => <li key={it.label}><NavLink item={it} /></li>)}
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
              {fan && (
                <div className="absolute right-[24px] top-[24px] flex items-center gap-[12px] max-lg:gap-[8px]">
                  <Link href={`/${slug}/account`} className="fig-btn-sm fig-btn-sm-ghost max-w-[140px] truncate px-[16px] max-lg:h-[36px] max-lg:px-[12px] max-lg:text-[14px]">{fan.display_name ?? "Account"}</Link>
                  {admin && <Link href={`/${slug}/admin`} className="fig-btn-sm fig-btn-sm-ghost px-[16px] max-lg:h-[36px] max-lg:px-[12px] max-lg:text-[14px]">Admin</Link>}
                  <form action={signOut.bind(null, slug)}><button type="submit" className="fig-btn-sm fig-btn-sm-white px-[16px] max-lg:h-[36px] max-lg:px-[12px] max-lg:text-[14px]">Sign Out</button></form>
                </div>
              )}
              <div className="absolute bottom-[21px] left-[24px] hidden h-[99px] w-[99px] overflow-hidden rounded-[7.5px] border border-muted bg-section-dark lg:block">
                <Image src={avatar} alt="" fill sizes="99px" className="object-cover object-[50%_19%]" />
              </div>
              <div className="absolute bottom-[27px] left-[139px] hidden lg:block">
                <h1 className="text-[48px] leading-none">{channel.name}</h1>
              </div>
              <div className="absolute bottom-[24px] left-[24px] lg:hidden">
                <h1 className="text-[32px] leading-none">{channel.name}</h1>
              </div>
            </div>
          </header>
          <main className="flex-1">{children}</main>
          <BottomNav items={nav} />
          <footer className="mx-auto mt-[24px] flex max-w-[1440px] flex-wrap items-center gap-x-[20px] gap-y-2 px-[24px] text-[13px] text-white/60">
            <Link href={`/${slug}/privacy`} className="hover:text-white">Privacy</Link>
            <a href={fanfestUrl()} rel="noopener" className="hover:text-white">Fan club on FanFest</a>
            {fan && <Link href={`/${slug}/account`} className="hover:text-white">Account</Link>}
            {admin && <Link href={`/${slug}/admin`} className="hover:text-white">Admin</Link>}
          </footer>
        </div>
        <XpFromQuery />
      </JoinModalProvider>
    </ToastProvider>
  );
}
