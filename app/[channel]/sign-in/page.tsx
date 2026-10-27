import { redirect } from "next/navigation";
import { getViewer } from "@/lib/data";
import { SignInForm } from "./SignInForm";
import { safeNext } from "@/lib/safe-next";
import { requestOrigin } from "@/lib/site";

export default async function SignInPage({ params, searchParams }: { params: Promise<{ channel: string }>; searchParams: Promise<{ next?: string; mode?: string; error?: string }> }) {
  const { channel: slug } = await params;
  const { next, mode, error } = await searchParams;
  const { fan } = await getViewer();
  const safe = safeNext(slug, next, await requestOrigin());
  if (fan) redirect(safe);
  return (
    <div className="mx-auto max-w-md px-[24px] pt-[24px]">
      <h2 className="display text-4xl">{mode === "signup" ? "Sign up" : "Sign in"}</h2>
      <p className="mt-2 text-sm text-muted">Enter your email and we send you a sign-in link, plus a 6-digit code where the email shows one. No password to remember. New here? The same email creates your account.</p>
      {error === "link" && <p className="mt-3 text-sm text-danger">That link expired, was already used, or was opened in a different browser. Request a new one below.</p>}
      <SignInForm slug={slug} next={next ? safe : undefined} />
    </div>
  );
}
