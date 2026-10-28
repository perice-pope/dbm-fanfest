import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getChannel, getFanContext, getViewer, isAdminOf, settingsOf, type Quest } from "@/lib/data";
import { questView, configOf, RESPONSE_TYPES, UPLOAD_TYPES, REJECT_REASONS } from "@/lib/quest-state";
import { fmtXp, fmtDeadline } from "@/lib/format";
import { ResponseForm } from "./ResponseForm";
import { UploadForm } from "./UploadForm";
import { LinkForm } from "./LinkForm";
import { JoinListForm } from "./JoinListForm";
import { InvitePanel } from "./InvitePanel";
import { ListenPanel } from "./ListenPanel";
import { creditedToday, type ListenConfig } from "@/lib/listen-match";
import { periodKey } from "@/lib/period";
import { lastfmConfigured } from "@/lib/lastfm";
import { Suspense } from "react";
import { requestOrigin } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function QuestPage({ params }: { params: Promise<{ channel: string; quest: string }> }) {
  const { channel: slug, quest: questId } = await params;
  const channel = await getChannel(slug);
  if (!channel) notFound();
  const sb = await createClient();
  const { data: quest } = await sb.from("quests").select("*").eq("id", questId).eq("channel_id", channel.id).maybeSingle();
  const { fan } = await getViewer();
  // Drafts stay hidden from fans; channel admins can open one to test it before launch.
  const preview = !!quest && quest.status === "draft" && !!fan && (await isAdminOf(channel.id));
  if (!quest || (quest.status !== "live" && !preview)) notFound();
  const ctx = await getFanContext(channel, fan);
  const view = questView(quest as Quest, { tz: channel.timezone, now: new Date(), lifetimeXp: ctx.lifetimeXp, ledger: ctx.ledger, submissions: ctx.submissions });
  const cfg = configOf(quest as Quest);
  const settings = settingsOf(channel);
  const here = `/${slug}/q/${questId}`;
  const signedIn = !!fan;
  const canAct = signedIn && (view.state === "available" || (view.state === "rejected" && view.retryAllowed));
  const origin = await requestOrigin();
  const listenAccount = signedIn && quest.type === "listen"
    ? (await sb.from("listen_accounts").select("service, username, connected_at, last_synced_at").eq("fan_id", fan!.id).maybeSingle()).data
    : null;
  const listenCfg = cfg as ListenConfig;

  return (
    <div className="mx-auto max-w-md px-[24px] pt-[24px]">
      {preview && <p className="mb-3 rounded-[8px] border border-yellow p-3 text-sm text-yellow">Draft preview. Fans cannot see this quest until its status is live.</p>}
      <Link href={`/${slug}#quests`} className="text-xs uppercase tracking-[0.12em] text-muted hover:text-text">‹ Quests</Link>
      <div className="mt-3 flex items-center gap-3">
        <span className="badge-xp">{fmtXp(quest.xp)} XP</span>
        {view.resetsLabel && <span className="text-xs text-muted">{view.resetsLabel}</span>}
      </div>
      <h2 className="display mt-3 text-4xl leading-[0.95]">{quest.title}</h2>
      {quest.description && <p className="mt-2 text-sm text-muted">{quest.description}</p>}
      {quest.deadline && <p className="mt-2 text-xs uppercase tracking-[0.12em] text-muted">Ends {fmtDeadline(quest.deadline, channel.timezone)}</p>}
      {cfg.hint && <p className="mt-3 rounded-[var(--radius-sm)] bg-surface-2 p-3 text-sm">{cfg.hint}</p>}

      <div className="mt-5">
        {!signedIn && (
          <div className="card p-5 text-center">
            <p className="text-sm text-muted">Sign in to earn XP for this quest.</p>
            <Link href={`/${slug}/sign-in?next=${encodeURIComponent(here)}`} className="btn btn-primary mt-3 w-full">Sign in</Link>
          </div>
        )}
        {signedIn && view.state === "expired" && <p className="card p-5 text-sm text-muted">This quest has ended.</p>}
        {signedIn && view.state === "locked" && <p className="card p-5 text-sm text-muted">Unlocks when you hold {fmtXp(quest.lock_min_xp)} lifetime XP. You have {fmtXp(ctx.lifetimeXp)}.</p>}
        {signedIn && view.state === "in_review" && (
          <p className="card p-5 text-sm">Submitted. XP lands when the band reviews it. <span className="text-muted">{settings.review_cadence ?? ""}</span></p>
        )}
        {signedIn && view.state === "completed" && quest.type !== "invite" && quest.type !== "listen" && (
          <p className="card p-5 text-sm"><span className="text-success">Completed.</span> {view.resetsLabel ? `${view.resetsLabel}.` : "Nice work."}</p>
        )}
        {signedIn && view.state === "rejected" && view.latest?.reject_reason && (
          <p className="card mb-4 p-4 text-sm text-danger">{REJECT_REASONS[view.latest.reject_reason]}{view.latest.reject_note ? ` ${view.latest.reject_note}` : ""}{view.retryAllowed && view.latest.reject_mode !== "final" ? " You can try once more below." : " This quest is now closed for you."}</p>
        )}

        {signedIn && quest.type === "invite" && <InvitePanel slug={slug} code={fan!.referral_code} xp={quest.xp} cap={cfg.cap ?? 10} converted={ctx.ledger.filter((l) => l.quest_id === quest.id && l.xp > 0).length} origin={origin} />}
        {signedIn && quest.type === "visit_link" && view.state === "available" && (
          <a href={`/go/${slug}/${quest.id}`} className="btn btn-primary w-full">{quest.cta_label ?? "Visit link"}</a>
        )}
        {signedIn && quest.type === "daily_visit" && <p className="card p-5 text-sm text-muted">Open this page once a day while signed in. The XP lands on arrival.</p>}
        {canAct && RESPONSE_TYPES.has(quest.type) && <ResponseForm slug={slug} questId={quest.id} type={quest.type} questions={cfg.questions ?? []} />}
        {canAct && UPLOAD_TYPES.has(quest.type) && (
          <UploadForm slug={slug} questId={quest.id} channelId={channel.id} fanId={fan!.id} type={quest.type} kind={cfg.kind} rights={cfg.rights} auto={!!cfg.auto_approve} reviewCadence={settings.review_cadence} />
        )}
        {signedIn && quest.type === "listen" && (view.state === "available" || view.state === "completed") && (
          <Suspense><ListenPanel slug={slug} questId={quest.id} account={listenAccount} today={creditedToday(ctx.ledger, quest.id, periodKey("daily", channel.timezone, new Date()))} cap={listenCfg.daily_cap ?? 4} xp={quest.xp} anyXp={listenCfg.any_play_xp ?? 0} anyCap={listenCfg.any_play_cap ?? 10} lastfmReady={lastfmConfigured()} /></Suspense>
        )}
        {canAct && quest.type === "social_link" && <LinkForm slug={slug} questId={quest.id} reviewCadence={settings.review_cadence} />}
        {canAct && quest.type === "email_signup" && <JoinListForm slug={slug} consent={cfg.consent ?? "Yes, email me about the band."} joined={ctx.joinedList} />}
        {signedIn && quest.type === "email_signup" && view.state === "completed" && <p className="mt-3 text-xs text-muted">You are on the list. Change this any time in Account.</p>}
      </div>
    </div>
  );
}
