import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getChannel, settingsOf } from "@/lib/data";
import { merchUrl } from "@/lib/site";

export const metadata: Metadata = { title: "Merch" };
export const dynamic = "force-dynamic";

/** Placeholder until a store URL is configured (NEXT_PUBLIC_MERCH_URL); with one set, the nav links straight to the store and this page offers the same link. */
export default async function MerchPage({ params }: { params: Promise<{ channel: string }> }) {
  const { channel: slug } = await params;
  const channel = await getChannel(slug);
  if (!channel) notFound();
  const store = merchUrl();
  const storeName = settingsOf(channel).merch_store_name || `${channel.name} Store`;
  return (
    <section id="merch" aria-label="Merch" className="mt-[25px] scroll-mt-2 bg-section-dark lg:mt-[51px]">
      <div className="mx-auto max-w-[1440px] px-[24px] pb-[40px] pt-[36px]">
        <h2 className="text-[32px] leading-none">Merch</h2>
        {store ? (
          <>
            <p className="mt-[36px] max-w-[640px] text-[16px] leading-[20px]">Shirts, vinyl and more at the {storeName}.</p>
            <div className="mt-[24px] lg:w-[320px]"><a href={store} target="_blank" rel="noopener noreferrer" className="fig-btn fig-btn-yellow">Open the store</a></div>
          </>
        ) : (
          <>
            <p className="mt-[36px] max-w-[640px] text-[16px] leading-[20px]">The {storeName} is on its way. Until it opens, catch the band at a show for shirts and vinyl.</p>
            <span className="fig-chip mt-[24px]">Coming soon</span>
          </>
        )}
      </div>
    </section>
  );
}
