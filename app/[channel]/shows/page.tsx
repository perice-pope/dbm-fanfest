import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getChannel } from "@/lib/data";
import { SHOWS, splitShows, todayKey } from "@/lib/shows";
import { ShowsList } from "@/components/ShowsList";

export const metadata: Metadata = { title: "Shows" };
export const dynamic = "force-dynamic";

export default async function ShowsPage({ params }: { params: Promise<{ channel: string }> }) {
  const { channel: slug } = await params;
  const channel = await getChannel(slug);
  if (!channel) notFound();
  const { upcoming, past } = splitShows(SHOWS, todayKey(channel.timezone));
  return (
    <>
      <section id="shows" aria-label="Upcoming shows" className="mt-[25px] scroll-mt-2 bg-section-dark lg:mt-[51px]">
        <div className="mx-auto max-w-[1440px] px-[24px] pb-[24px] pt-[36px]">
          <h2 className="text-[32px] leading-none">Shows</h2>
          <div className="mt-[36px]"><ShowsList shows={upcoming} empty="No shows announced yet. Follow the band's socials for the next dates." /></div>
        </div>
      </section>
      {past.length > 0 && (
        <section aria-label="Past shows" className="bg-section-quests">
          <div className="mx-auto max-w-[1440px] px-[24px] pb-[40px] pt-[30px]">
            <h2 className="text-[32px] leading-none">Past shows</h2>
            <div className="mt-[20px] lg:mt-[36px]"><ShowsList shows={past} empty="" /></div>
          </div>
        </section>
      )}
    </>
  );
}
