import Link from "next/link";

export type NavItem = { label: string; href: string; external?: boolean };

/** Bottom navigation pill: 600x48 on desktop, 360x48 on phones, white 1px stroke. */
export function BottomNav({ items }: { items: NavItem[] }) {
  return (
    <nav aria-label="Site" className="mx-auto mt-[24px] flex h-[48px] w-[360px] max-w-[calc(100%-32px)] items-center justify-around rounded-[24px] border border-white bg-section-dark px-2 text-[16px] lg:w-[600px]">
      {items.map((it) => <NavLink key={it.label} item={it} className="px-2 leading-none hover:underline" />)}
    </nav>
  );
}

export function NavLink({ item, className }: { item: NavItem; className?: string }) {
  return item.external
    ? <a href={item.href} rel="noopener" className={className}>{item.label}</a>
    : <Link href={item.href} className={className}>{item.label}</Link>;
}

/**
 * The band site's pages, in the Figma's order. Shows and News live here; Merch goes straight to the store when one is
 * configured (else to the placeholder page); Community is the fan club on FanFest.
 */
export function navItems(slug: string, { merchUrl, communityUrl }: { merchUrl: string | null; communityUrl: string }): NavItem[] {
  return [
    { label: "Shows", href: `/${slug}/shows` },
    { label: "News", href: `/${slug}#news` },
    merchUrl ? { label: "Merch", href: merchUrl, external: true } : { label: "Merch", href: `/${slug}/merch` },
    { label: "Community", href: communityUrl, external: true },
  ];
}
