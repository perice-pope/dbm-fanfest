import Link from "next/link";
import Image from "next/image";
import { getChannel } from "@/lib/data";
import { NavLink, navItems } from "@/components/BottomNav";
import { SocialRow } from "@/components/SocialRow";
import { linksOf } from "@/lib/channel-view";
import { fanfestUrl, merchUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

/** Landing page from the Figma "/home-page-for-dbm": full-bleed band photo, page links, script logo. */
export default async function Landing() {
  const channel = await getChannel("destroyedbymoths");
  const slug = "destroyedbymoths";
  const nav = navItems(slug, { merchUrl: merchUrl(), communityUrl: fanfestUrl() });
  const logo = channel?.logo_url || "/dbm/logo.png";
  const links = channel ? linksOf(channel) : {};
  return (
    <main className="relative min-h-[100dvh] w-full overflow-hidden bg-black text-white">
      {/* The band photo fills the frame at its own proportions (the Figma's 2.25x blow-up stretched it on desktop); the crop sits on the faces. */}
      <Image src="/dbm/landing.jpg" alt="" fill priority sizes="100vw" className="object-cover object-[50%_30%]" />
      <div className="absolute inset-0" style={{ backgroundImage: "linear-gradient(180deg, rgba(47,39,42,0.5) 0.0%, rgba(47,39,42,0.71) 100.0%)" }} aria-hidden="true" />
      <div className="relative mx-auto h-[100dvh] max-w-[1280px]">
        <ul className="absolute left-[51px] top-[68px] z-10 hidden items-center gap-[32px] text-[16px] leading-none tracking-[0.5px] lg:flex" aria-label="Pages">
          {nav.map((it) => <li key={it.label}><NavLink item={it} /></li>)}
        </ul>
        <ul className="absolute inset-x-0 top-[30px] z-10 flex items-center justify-center gap-[30px] text-[16px] leading-none tracking-[0.5px] lg:hidden" aria-label="Pages">
          {nav.map((it) => <li key={it.label}><NavLink item={it} /></li>)}
        </ul>
        <SocialRow links={links as Record<string, string | null | undefined>} className="absolute z-10 max-lg:left-1/2 max-lg:top-[112px] max-lg:-translate-x-1/2 lg:right-[51px] lg:top-[66px]" />
        <Link href={`/${slug}`} className="absolute left-1/2 top-[56px] -translate-x-1/2 lg:top-[24px]" aria-label="Destroyed by Moths">
          <Image src={logo} alt="Destroyed by Moths" width={510} height={102} priority className="h-[40px] w-[200px] object-cover object-center lg:h-[102px] lg:w-[510px]" />
        </Link>
      </div>
    </main>
  );
}
