"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendCode, verifyCode } from "@/app/[channel]/actions";

export function SignInForm({ slug, next }: { slug: string; next?: string }) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function onSend(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await sendCode(slug, email, next);
      if (!r.ok) return setError(r.error);
      setStep("code");
    });
  }
  function onVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await verifyCode(slug, email, token, next);
      if (!r.ok) return setError(r.error);
      router.replace(r.data.next);
      router.refresh();
    });
  }

  if (step === "email") {
    return (
      <form onSubmit={onSend} className="card mt-5 space-y-3 p-5">
        <label className="block text-xs uppercase tracking-[0.12em] text-muted" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" inputMode="email" autoComplete="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        {error && <p className="text-sm text-danger">{error}</p>}
        <button type="submit" className="btn btn-primary w-full" disabled={pending}>{pending ? "Sending…" : "Continue"}</button>
      </form>
    );
  }
  return (
    <form onSubmit={onVerify} className="card mt-5 space-y-3 p-5">
      <p className="text-sm">Check <span className="font-medium">{email}</span>. Tap the link in the email on this device, or type the code below if the email shows one.</p>
      <label className="block text-xs uppercase tracking-[0.12em] text-muted" htmlFor="token">6-digit code</label>
      <input id="token" name="token" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,8}" required className="input text-center text-2xl tracking-[0.4em]" value={token} onChange={(e) => setToken(e.target.value.replace(/\D/g, ""))} />
      {error && <p className="text-sm text-danger">{error}</p>}
      <button type="submit" className="btn btn-primary w-full" disabled={pending || token.length < 6}>{pending ? "Checking…" : "Continue"}</button>
      <button type="button" className="btn btn-ghost w-full" onClick={() => { setStep("email"); setToken(""); }}>Use a different email</button>
    </form>
  );
}
