import Link from "next/link";

export type NavItem = { label: string; href: string; external?: boolean };

/** Bottom navigation pill: 600x48 on desktop, 360x48 on phones, white 1px stroke. */
export function BottomNav({ items }: { items: NavItem[] }) {
  return (
    <nav aria-label="Site" className="mx-auto mt-[24px] flex h-[48px] w-[360px] max-w-[calc(100%-32px)] items-center justify-around rounded-[24px] border border-white bg-section-dark px-2 text-[16px] lg:w-[600px]">
      {items.map((it) => it.external ? (
        <a key={it.label} href={it.href} className="px-2 leading-none hover:underline">{it.label}</a>
      ) : (
        <Link key={it.label} href={it.href} className="px-2 leading-none hover:underline">{it.label}</Link>
      ))}
    </nav>
  );
}

export function navItems(slug: string, links: { shows?: string | null; merch?: string | null; community?: string | null }): NavItem[] {
  return [
    { label: "Shows", href: links.shows || `/${slug}#news`, external: !!links.shows },
    { label: "News", href: `/${slug}#news` },
    { label: "Merch", href: links.merch || `/${slug}#rewards`, external: !!links.merch },
    { label: "Community", href: links.community || `/${slug}#leaderboard`, external: !!links.community },
  ];
}

const SOCIAL: [string, string][] = [["facebook", "fa-facebook-f"], ["x", "fa-x-twitter"], ["instagram", "fa-instagram"], ["youtube", "fa-youtube"], ["tiktok", "fa-tiktok"], ["twitch", "fa-twitch"]];

export function SocialRow({ links, className }: { links: Record<string, string | null | undefined>; className?: string }) {
  return (
    <ul className={`flex items-center gap-[36px] max-lg:gap-[26px] ${className ?? ""}`} aria-label="Social links">
      {SOCIAL.map(([key, icon]) => (
        <li key={key}>
          <a href={links[key] || "#"} target={links[key] ? "_blank" : undefined} rel="noopener noreferrer" aria-label={key} className="text-[18px] text-white">
            <i className={`fa-brands ${icon}`} aria-hidden="true" />
          </a>
        </li>
      ))}
    </ul>
  );
}
