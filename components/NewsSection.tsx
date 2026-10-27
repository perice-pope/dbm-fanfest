"use client";
import { useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import type { NewsItem } from "@/lib/data";

type Item = NewsItem & { tag?: string | null; pinned?: boolean | null };

export function NewsSection({ items, shareBase }: { items: Item[]; shareBase: string }) {
  const [perSlide, setPerSlide] = useState(3);
  const [slide, setSlide] = useState(0);
  const { push } = useToast();
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const apply = () => setPerSlide(mq.matches ? 3 : 1);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  const slides = Math.max(1, Math.ceil(items.length / perSlide));
  const current = Math.min(slide, slides - 1);
  const visible = items.slice(current * perSlide, current * perSlide + perSlide);

  async function share(n: Item) {
    const url = n.link_url ?? `${shareBase}#news`;
    try {
      if (navigator.share) await navigator.share({ title: n.title, text: n.body ?? undefined, url });
      else { await navigator.clipboard.writeText(url); push("Link copied", "info"); }
    } catch { /* cancelled */ }
  }

  return (
    <section id="news" aria-label="News" className="scroll-mt-2 bg-section-dark">
      <div className="mx-auto max-w-[1440px] px-[24px] pb-[24px] pt-[36px]">
        <h2 className="text-[32px] leading-none">News</h2>
        <ul className="mt-[36px]">
          {visible.length === 0 && <li className="py-[24px] text-[16px]">No news yet.</li>}
          {visible.map((n) => (
            <li key={n.id} className="border-b border-hairline pb-[22px] pt-[24px] first:pt-[10px]">
              <h3 className="text-[20px] font-bold leading-none">{n.title}</h3>
              {n.body && <p className="mt-[20px] max-w-[1390px] text-[16px] leading-[20px]">{n.body}</p>}
              <div className="mt-[22px] flex flex-wrap items-center gap-[10px]">
                <span className="fig-chip">{n.tag || "Band update"}</span>
                {(n.pinned ?? n.sort_order <= 10) && <span className="fig-chip">Pinned</span>}
                <button type="button" className="ml-[14px] inline-flex items-center gap-[8px] text-[16px] leading-none" onClick={() => share(n)}>
                  <span className="mi-round text-[24px]" aria-hidden="true">share</span>Share
                </button>
                {n.link_url && <a href={n.link_url} target="_blank" rel="noopener noreferrer" className="ml-[10px] text-[16px] leading-none underline">{n.link_label ?? "Open"}</a>}
              </div>
            </li>
          ))}
        </ul>
        {slides > 1 ? (
          <div className="mt-[40px] flex gap-[12px] max-lg:justify-start lg:justify-center" role="tablist" aria-label="News pages">
            {Array.from({ length: slides }, (_, i) => (
              <button key={i} type="button" role="tab" aria-selected={i === current} aria-label={`Page ${i + 1}`} className={`h-[12px] w-[107px] rounded-[6px] lg:w-[118px] ${i === current ? "bg-white" : "bg-accent"}`} onClick={() => setSlide(i)} />
            ))}
          </div>
        ) : (
          <div className="mt-[40px] flex gap-[12px] max-lg:justify-start lg:justify-center" aria-hidden="true">
            <span className="h-[12px] w-[107px] rounded-[6px] bg-white lg:w-[118px]" />
          </div>
        )}
      </div>
    </section>
  );
}
