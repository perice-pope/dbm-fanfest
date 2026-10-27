/** Fixed "1 FAN ONLINE" pill from the Figma: bottom right on desktop, full width on phones. */
export function ChatBar({ online, href }: { online: number; href?: string | null }) {
  const inner = (
    <>
      <i className="fa-solid fa-comments text-[20px]" aria-hidden="true" />
      <span className="inline-block h-[14px] w-[14px] rounded-full bg-green" aria-hidden="true" />
      <span className="mono text-[16px] tracking-[0.01em]">{online} FAN{online === 1 ? "" : "S"} ONLINE</span>
    </>
  );
  const cls = "fixed bottom-[25px] z-40 flex h-[46px] items-center justify-center gap-[12px] rounded-[23px] border border-card-stroke-2 bg-chat px-[24px] text-white max-lg:inset-x-[24px] lg:right-[24px] lg:w-[242px]";
  return href ? <a href={href} className={cls} aria-label="Chat">{inner}</a> : <div className={cls} aria-label="Fans online">{inner}</div>;
}
