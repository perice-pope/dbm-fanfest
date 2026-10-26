"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

type Toast = { id: number; text: string; kind: "xp" | "info" | "error" };
const Ctx = createContext<{ push: (text: string, kind?: Toast["kind"]) => void }>({ push: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const n = useRef(0);
  const push = useCallback((text: string, kind: Toast["kind"] = "info") => {
    const id = ++n.current;
    setItems((t) => [...t, { id, text, kind }]);
    setTimeout(() => setItems((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);
  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex flex-col items-center gap-2 px-4">
        {items.map((t) => (
          <div
            key={t.id}
            className={`toast rounded-full px-4 py-2 text-sm font-medium shadow-lg ${
              t.kind === "xp" ? "bg-accent text-accent-ink" : t.kind === "error" ? "bg-danger text-white" : "bg-surface-2 text-text border border-line"
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  return useContext(Ctx);
}

/** Shows an XP toast once when the page lands with ?xp=N (used after redirects). */
export function XpFromQuery() {
  const { push } = useToast();
  useEffect(() => {
    const url = new URL(window.location.href);
    const xp = url.searchParams.get("xp");
    const msg = url.searchParams.get("msg");
    if (xp && Number(xp) > 0) push(`+${Number(xp).toLocaleString()} XP`, "xp");
    else if (msg) push(msg, "info");
    if (xp || msg) {
      url.searchParams.delete("xp");
      url.searchParams.delete("msg");
      window.history.replaceState({}, "", url.toString());
    }
  }, [push]);
  return null;
}
