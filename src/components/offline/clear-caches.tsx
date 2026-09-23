"use client";

import { useEffect } from "react";

/**
 * Mounted on the sign-in page. Reaching it means no one is signed in here, so
 * the pages cached for offline reading are dropped; the next person on this
 * device cannot page back through someone else's data. Queued writes are kept:
 * they are sent when their own account signs in again.
 */
export function ClearOfflineCaches() {
  useEffect(() => {
    if (typeof caches === "undefined") return;
    void caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("aio-")).map((key) => caches.delete(key))))
      .catch(() => undefined);
  }, []);
  return null;
}
