"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { pickWinner } from "../actions";
import { useToast } from "@/components/Toast";

export function PickWinner({ slug, id }: { slug: string; id: string }) {
  const [pending, start] = useTransition();
  const { push } = useToast();
  const router = useRouter();
  return (
    <button type="button" className="btn btn-secondary ml-3 px-3 text-xs" disabled={pending} onClick={() => {
      if (!window.confirm("Pick a random winner now? This closes the draw.")) return;
      start(async () => { const r = await pickWinner(slug, id); if (!r.ok) return push(r.error, "error"); push("Winner picked", "info"); router.refresh(); });
    }}>Pick winner</button>
  );
}
