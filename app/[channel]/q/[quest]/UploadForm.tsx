"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import imageCompression from "browser-image-compression";
import { createClient } from "@/lib/supabase/client";
import { createSubmission } from "@/app/[channel]/actions";
import { useToast } from "@/components/Toast";

const MAX_MB = 10;

async function sha256Hex(buf: ArrayBuffer) {
  const h = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function UploadForm({ slug, questId, channelId, fanId, type, kind, rights, auto, reviewCadence }: {
  slug: string; questId: string; channelId: string; fanId: string; type: string; kind?: string; rights?: string; auto: boolean; reviewCadence?: string;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [handle, setHandle] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [consentFeatured, setConsentFeatured] = useState(false);
  const [consentRights, setConsentRights] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ status: string; xp: number } | null>(null);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const { push } = useToast();
  const router = useRouter();

  const isArt = type === "photo_proof" && (kind === "fan_art" || kind === "merch_wild");
  const isReceipt = type === "receipt_proof";
  const isSocial = type === "social_screenshot";
  const needsRights = isArt && !!rights;

  function pick(f: File | null) {
    setError(null);
    setFile(f);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return setError("Choose a photo first.");
    if (needsRights && !consentRights) return setError("Tick the rights box to continue.");
    if (isReceipt && orderNumber.trim().length < 3) return setError("Type the order number from the receipt.");
    setError(null);
    start(async () => {
      try {
        setProgress("Preparing photo…");
        const compressed = await imageCompression(file, { maxSizeMB: MAX_MB - 1, maxWidthOrHeight: 2048, useWebWorker: true, fileType: "image/jpeg", initialQuality: 0.88 });
        if (compressed.size > MAX_MB * 1024 * 1024) throw new Error("That photo is too large even after resizing. Try a smaller one.");
        const buf = await compressed.arrayBuffer();
        const sha = await sha256Hex(buf);
        const path = `${channelId}/${fanId}/${crypto.randomUUID()}.jpg`;
        setProgress("Uploading…");
        const sb = createClient();
        const { error: upErr } = await sb.storage.from("proofs").upload(path, compressed, { contentType: "image/jpeg", upsert: false });
        if (upErr) throw new Error("Upload failed. Check your connection and try again.");
        setProgress("Saving…");
        const r = await createSubmission(slug, questId, {
          kind: "image", imagePath: path, sha256: sha, caption: caption || undefined, handle: handle || undefined, orderNumber: orderNumber || undefined,
          consentFeatured, consentRights,
        });
        if (!r.ok) throw new Error(r.error);
        setDone({ status: r.data.status, xp: r.data.xp });
        if (r.data.awarded) push(`+${r.data.xp.toLocaleString()} XP`, "xp");
        router.refresh();
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setProgress(null);
      }
    });
  }

  if (done) {
    return (
      <div className="card p-5">
        {done.status === "approved" ? (
          <>
            <p className="display text-3xl text-success">Done</p>
            <p className="mt-1 text-sm text-muted">+{done.xp.toLocaleString()} XP. {isArt ? "The band sees it now and may feature it." : ""}</p>
          </>
        ) : (
          <>
            <p className="display text-3xl">Submitted</p>
            <p className="mt-1 text-sm text-muted">XP lands when the band reviews it. {reviewCadence ?? ""}</p>
          </>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="card p-4">
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
        {preview ? (
          <div className="space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Your photo" className="max-h-80 w-full rounded-[var(--radius-sm)] object-contain bg-bg" />
            <button type="button" className="btn btn-secondary w-full" onClick={() => inputRef.current?.click()}>Choose a different photo</button>
          </div>
        ) : (
          <button type="button" className="flex w-full flex-col items-center gap-2 rounded-[var(--radius-sm)] border border-dashed border-line py-10 text-sm text-muted hover:border-accent hover:text-text" onClick={() => inputRef.current?.click()}>
            <span className="display text-2xl text-text">Add a photo</span>
            <span>JPG, PNG or WebP · up to {MAX_MB} MB</span>
          </button>
        )}
        {isReceipt && <p className="mt-3 text-xs text-muted">Blur anything personal: card digits, your address.</p>}
      </div>
      {isArt && (
        <div>
          <label className="block text-xs uppercase tracking-[0.12em] text-muted" htmlFor="caption">Caption</label>
          <input id="caption" className="input mt-1" maxLength={200} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Optional, 200 characters" />
        </div>
      )}
      {isReceipt && (
        <div>
          <label className="block text-xs uppercase tracking-[0.12em] text-muted" htmlFor="order">Order number</label>
          <input id="order" className="input mt-1" maxLength={60} value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} placeholder="From the receipt" required />
        </div>
      )}
      {isSocial && (
        <div>
          <label className="block text-xs uppercase tracking-[0.12em] text-muted" htmlFor="handle">Your handle</label>
          <input id="handle" className="input mt-1" maxLength={60} value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@handle visible in the screenshot" required />
        </div>
      )}
      {isArt && (
        <div className="space-y-2">
          <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--accent)]" checked={consentFeatured} onChange={(e) => setConsentFeatured(e.target.checked)} /> The band may share this.</label>
          {needsRights && <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--accent)]" checked={consentRights} onChange={(e) => setConsentRights(e.target.checked)} /> {rights}</label>}
        </div>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
      <button type="submit" className="btn btn-primary w-full" disabled={pending || !file}>{progress ?? (auto ? "Upload and earn XP" : "Submit for review")}</button>
    </form>
  );
}
