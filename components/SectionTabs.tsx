"use client";
import { useEffect, useState } from "react";

const TABS = [
  { id: "news", label: "News" },
  { id: "quests", label: "Quests" },
  { id: "rewards", label: "Rewards" },
] as const;

export function SectionTabs({ counts }: { counts: { news: number; quests: number; rewards: number } }) {
  const [active, setActive] = useState<string>("quests");
  useEffect(() => {
    const els = TABS.map((t) => document.getElementById(t.id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-40% 0px -50% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return (
    <nav className="sticky top-0 z-30 -mx-4 border-b border-line bg-bg/90 px-4 backdrop-blur sm:mx-0 sm:rounded-full sm:border sm:px-2" aria-label="Sections">
      <ul className="flex items-center justify-around gap-1 py-2">
        {TABS.map((t) => (
          <li key={t.id}>
            <a
              href={`#${t.id}`}
              onClick={(e) => { e.preventDefault(); document.getElementById(t.id)?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
              className={`display flex items-center gap-2 rounded-full px-4 py-1.5 text-lg tracking-wider ${active === t.id ? "bg-accent text-accent-ink" : "text-muted hover:text-text"}`}
            >
              {t.label} <span className={`text-sm ${active === t.id ? "text-accent-ink/70" : "text-muted"}`}>{counts[t.id]}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
