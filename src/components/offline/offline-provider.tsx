"use client";

import { useEffect } from "react";
import { initOffline } from "@/lib/offline/queue";
import { SyncStatus } from "./sync-status";

/**
 * Starts the offline layer for the signed-in account: registers the service
 * worker that keeps pages readable with no connection, and opens the queue
 * that holds writes until the connection returns.
 */
export function OfflineProvider({ userId }: { userId: string }) {
  useEffect(() => {
    void initOffline(userId);
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      // Registered after load so it never competes with the first paint.
      const register = () => void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
      if (document.readyState === "complete") register();
      else window.addEventListener("load", register, { once: true });
    }
  }, [userId]);

  return <SyncStatus />;
}
