"use client";
import { useRef } from "react";

/** Horizontal card rail with the Figma's west/east arrows under it. */
export function Rail({ children, label }: { children: React.ReactNode; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  function by(dir: 1 | -1) {
    const el = ref.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>(":scope > *");
    const step = (card?.offsetWidth ?? 320) + 25;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  }
  return (
    <>
      <div ref={ref} className="rail -mx-[24px] px-[24px]" aria-label={label}>{children}</div>
      <div className="mt-[49px] flex items-center gap-[16px] pb-[16px] lg:mt-[51px]">
        <button type="button" aria-label="Previous" className="mi-sharp text-[32px]" onClick={() => by(-1)}>west</button>
        <button type="button" aria-label="Next" className="mi-sharp text-[32px]" onClick={() => by(1)}>east</button>
      </div>
    </>
  );
}
