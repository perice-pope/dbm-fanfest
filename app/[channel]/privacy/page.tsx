import Link from "next/link";
import { getViewer } from "@/lib/data";

export default async function PrivacyPage({ params }: { params: Promise<{ channel: string }> }) {
  const { channel: slug } = await params;
  const { fan } = await getViewer();
  return (
    <div className="mx-auto max-w-md space-y-4 px-[24px] pt-[24px]">
      <h2 className="display text-4xl">Privacy settings</h2>
      <div className="card space-y-3 p-5 text-sm text-muted">
        <p>This page sets only the cookies it needs: one to keep you signed in and one to remember who invited you, for 30 days. No advertising or tracking cookies.</p>
        <p>Photos you upload are private to you and the band unless you tick “The band may share this”. Receipt images are deleted 30 days after review.</p>
        <p>Your name shows on the leaderboard and in Recent activity unless you turn that off. Hidden fans keep earning XP.</p>
      </div>
      {fan ? (
        <Link href={`/${slug}/account`} className="btn btn-primary w-full">Change my settings</Link>
      ) : (
        <Link href={`/${slug}/sign-in`} className="btn btn-secondary w-full">Sign in to change settings</Link>
      )}
    </div>
  );
}
