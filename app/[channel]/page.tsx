import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getChannel, settingsOf, type NewsItem } from "@/lib/data";
import { NewsSection } from "@/components/NewsSection";
import { ShowsList } from "@/components/ShowsList";
import { SHOWS, splitShows, todayKey } from "@/lib/shows";
import { fanfestUrl, requestOrigin } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** The band's home page: News (from Supabase, edited in the admin area), the next shows, and the door to the fan club on FanFest. */
export default async function ChannelPage({ params }: { params: Promise<{ channel: string }> }) {
  const { channel: slug } = await params;
  const channel = await getChannel(slug);
  if (!channel) notFound();
  const sb = await createClient();
  const [news, origin] = await Promise.all([
    sb.from("news_items").select("*").eq("channel_id", channel.id).eq("is_active", true).order("sort_order", { ascending: true }).order("published_at", { ascending: false }),
    requestOrigin(),
  ]);
  const { upcoming } = splitShows(SHOWS, todayKey(channel.timezone));
  const avatar = settingsOf(channel).avatar_url || "/dbm/avatar.jpg";
  const community = fanfestUrl();

  return (
    <>
      <div className="mt-[25px] lg:mt-[51px]">
        <NewsSection items={(news.data ?? []) as NewsItem[]} shareBase={`${origin}/${slug}`} />
      </div>
      <section id="shows" aria-label="Shows" className="scroll-mt-2 bg-section-quests">
        <div className="mx-auto max-w-[1440px] px-[24px] pb-[40px] pt-[30px]">
          <h2 className="text-[32px] leading-none">Shows</h2>
          <div className="mt-[20px] lg:mt-[36px]">
            <ShowsList shows={upcoming.slice(0, 3)} empty="No shows announced yet." />
          </div>
          <Link href={`/${slug}/shows`} className="mt-[24px] inline-flex items-center gap-[8px] text-[16px] leading-none underline">
            All shows<span className="mi-sharp text-[24px]" aria-hidden="true">east</span>
          </Link>
        </div>
      </section>
      <section id="community" aria-label="Community" className="scroll-mt-2 bg-section-dark">
        <div className="mx-auto max-w-[1440px] px-[24px] pb-[48px] pt-[30px]">
          <h2 className="text-[32px] leading-none">Community</h2>
          <div className="fig-card mt-[20px] flex flex-col gap-[25px] p-[24px] lg:mt-[36px] lg:flex-row lg:items-center lg:p-[32px]">
            <span className="relative block h-[89px] w-[89px] shrink-0 overflow-hidden rounded-[7.5px] border border-muted bg-section-dark">
              <Image src={avatar} alt="" fill sizes="89px" className="object-cover object-[50%_19%]" />
            </span>
            <div className="flex-1">
              <p className="text-[24px] leading-tight">Join the {channel.name} fan club on FanFest</p>
              <p className="mt-[16px] text-[16px] leading-[20px]">Quests, the leaderboard, rewards and fan chat all live there. Free to join.</p>
            </div>
            <div className="shrink-0 lg:w-[320px]"><a href={community} rel="noopener" className="fig-btn fig-btn-yellow">Open the community</a></div>
          </div>
        </div>
      </section>
    </>
  );
}
