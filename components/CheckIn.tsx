"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { checkIn } from "@/app/[channel]/actions";

/** Fires the daily visit award once per page session; the server dedupes by channel-local date. */
export function CheckIn({ slug, todayKey }: { slug: string; todayKey: string }) {
  const { push } = useToast();
  const router = useRouter();
  useEffect(() => {
    const k = `ff:checkin:${slug}:${todayKey}`;
    if (sessionStorage.getItem(k)) return;
    sessionStorage.setItem(k, "1");
    checkIn(slug).then((r) => {
      if (r.ok && r.data.awarded) {
        push(`+${r.data.xp.toLocaleString()} XP · Daily visit`, "xp");
        router.refresh();
      }
    });
  }, [slug, todayKey, push, router]);
  return null;
}
