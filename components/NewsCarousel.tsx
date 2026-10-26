"use client";
import { useState } from "react";
import Image from "next/image";
import type { NewsItem } from "@/lib/data";

export function NewsCarousel({ items }: { items: NewsItem[] }) {
  const [i, setI] = useState(0);
  if (items.length === 0) return null;
  const n = items[i];
  return (
    <section id="news" className="card overflow-hidden" aria-label="News">
      {n.image_url && (
        <div className="relative aspect-[16/9] w-full bg-surface-2">
          <Image src={n.image_url} alt="" fill className="object-cover" sizes="(max-width: 640px) 100vw, 640px" />
        </div>
      )}
      <div className="p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <h2 className="display text-2xl">News <span className="text-muted">{items.length}</span></h2>
          <span className="text-xs text-muted">Slide {i + 1} of {items.length}</span>
        </div>
        <h3 className="mt-3 text-lg font-semibold">{n.title}</h3>
        {n.body && <p className="mt-1 text-sm text-muted">{n.body}</p>}
        <div className="mt-4 flex items-center justify-between gap-3">
          {n.link_url ? (
            <a href={n.link_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">{n.link_label ?? "Open"}</a>
          ) : <span />}
          {items.length > 1 && (
            <div className="flex gap-2">
              <button type="button" aria-label="Previous" className="btn btn-secondary px-3" onClick={() => setI((i - 1 + items.length) % items.length)}>‹</button>
              <button type="button" aria-label="Next" className="btn btn-secondary px-3" onClick={() => setI((i + 1) % items.length)}>›</button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
