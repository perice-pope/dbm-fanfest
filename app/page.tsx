import Link from "next/link";
import Image from "next/image";
import { getChannel } from "@/lib/data";
import { linksOf } from "@/lib/channel-view";
import { navItems } from "@/components/BottomNav";

export const dynamic = "force-dynamic";

/** Landing page from the Figma "/home-page-for-dbm": full-bleed band photo, page links, script logo. */
export default async function Landing() {
  const channel = await getChannel("destroyedbymoths");
  const slug = "destroyedbymoths";
  const nav = navItems(slug, channel ? linksOf(channel) : {});
  const logo = channel?.logo_url || "/dbm/logo.png";
  return (
    <main className="relative min-h-[100dvh] w-full overflow-hidden bg-black text-white">
      {/* Figma places the photo at 2.25x the frame width, shifted up 18% (desktop) and 2.87x, shifted left 94% (phones). */}
      <div className="absolute left-[-93.6%] top-0 h-full w-[287%] lg:left-[-62.66%] lg:top-[-18.15%] lg:h-[179.2%] lg:w-[225%]">
        <Image src="/dbm/landing.jpg" alt="" fill priority sizes="300vw" className="object-fill" />
      </div>
      <div className="absolute inset-0" style={{ backgroundImage: "linear-gradient(180deg, rgba(47,39,42,0.5) 0.0%, rgba(47,39,42,0.71) 100.0%)" }} aria-hidden="true" />
      <div className="relative mx-auto h-[100dvh] max-w-[1280px]">
        <ul className="absolute left-[51px] top-[68px] hidden items-center gap-[32px] text-[16px] leading-none tracking-[0.5px] lg:flex" aria-label="Pages">
          {nav.map((it) => <li key={it.label}>{it.external ? <a href={it.href}>{it.label}</a> : <Link href={it.href}>{it.label}</Link>}</li>)}
        </ul>
        <ul className="absolute inset-x-0 top-[30px] flex items-center justify-center gap-[30px] text-[16px] leading-none tracking-[0.5px] lg:hidden" aria-label="Pages">
          {nav.map((it) => <li key={it.label}>{it.external ? <a href={it.href}>{it.label}</a> : <Link href={it.href}>{it.label}</Link>}</li>)}
        </ul>
        <Link href={`/${slug}`} className="absolute left-1/2 top-[56px] -translate-x-1/2 lg:top-[24px]" aria-label="Destroyed by Moths">
          <Image src={logo} alt="Destroyed by Moths" width={510} height={102} priority className="h-[40px] w-[200px] object-cover object-center lg:h-[102px] lg:w-[510px]" />
        </Link>
      </div>
    </main>
  );
}
