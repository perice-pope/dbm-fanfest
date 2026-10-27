"use client";
import { useEffect, useState } from "react";

/** The Figma's top strip. It shows the same text only while the browser is offline. */
export function StatusBar() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  if (!offline) return null;
  return (
    <div role="status" className="flex h-[46px] items-center justify-center border-b border-card-stroke-2 bg-[var(--statusbar)] px-4 text-center text-[16px] leading-none">
      Showing saved channel data while we reconnect.
    </div>
  );
}
