import { formatShowDate, STATUS_LABEL, type Show } from "@/lib/shows";

/** Show rows in the News list's shape: hairline rows, mono date, chips, a white button on the right. */
export function ShowsList({ shows, empty }: { shows: Show[]; empty: string }) {
  if (shows.length === 0) return <p className="py-[24px] text-[16px]">{empty}</p>;
  return (
    <ul>
      {shows.map((s) => (
        <li key={s.id} className="flex flex-wrap items-center gap-x-[24px] gap-y-[14px] border-b border-hairline py-[22px] first:pt-[10px]">
          <time dateTime={s.date} className="mono w-[180px] shrink-0 text-[14px] leading-none">{formatShowDate(s.date)}</time>
          <div className="min-w-[200px] flex-1">
            <h3 className="text-[20px] font-bold leading-none">{s.city}</h3>
            <p className="mt-[10px] text-[16px] leading-[20px]">{s.venue}</p>
          </div>
          <div className="flex flex-wrap items-center gap-[10px]">
            <span className="fig-chip">{STATUS_LABEL[s.status]}</span>
            {s.placeholder && <span className="fig-chip">Placeholder</span>}
            {s.ticketUrl && s.status !== "sold_out" && (
              <a href={s.ticketUrl} target="_blank" rel="noopener noreferrer" className="fig-btn-sm fig-btn-sm-white ml-[14px] px-[20px]">Tickets</a>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
