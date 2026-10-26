import { redirect } from "next/navigation";
import { getChannel, getViewer } from "@/lib/data";
import { AccountForm } from "./AccountForm";
import { notFound } from "next/navigation";

export default async function AccountPage({ params, searchParams }: { params: Promise<{ channel: string }>; searchParams: Promise<{ first?: string; next?: string }> }) {
  const { channel: slug } = await params;
  const { first, next } = await searchParams;
  const channel = await getChannel(slug);
  if (!channel) notFound();
  const { fan } = await getViewer();
  if (!fan) redirect(`/${slug}/sign-in?next=${encodeURIComponent(`/${slug}/account`)}`);
  const handles = (fan.handles ?? {}) as { instagram?: string | null; tiktok?: string | null };
  return (
    <div className="mx-auto max-w-md">
      <h2 className="display text-4xl">{first ? "Pick your display name" : "Account"}</h2>
      <p className="mt-2 text-sm text-muted">{first ? "This is the name other fans see on the leaderboard. You can change it later." : fan.email}</p>
      <AccountForm slug={slug} next={next} fan={{ display_name: fan.display_name, instagram: handles.instagram ?? "", tiktok: handles.tiktok ?? "", show_on_leaderboard: fan.show_on_leaderboard, show_activity: fan.show_activity, newsletter_opt_in: fan.newsletter_opt_in, referral_code: fan.referral_code }} />
    </div>
  );
}
