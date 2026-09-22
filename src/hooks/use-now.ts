"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Current time rounded down to `intervalMs`, re-rendering once per interval.
 * Null during SSR and hydration, so server and client markup always match.
 */
export function useNow(intervalMs = 1000): number | null {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const id = setInterval(onChange, intervalMs);
      return () => clearInterval(id);
    },
    [intervalMs],
  );
  return useSyncExternalStore(
    subscribe,
    () => Math.floor(Date.now() / intervalMs) * intervalMs,
    () => null,
  );
}

const noop = () => () => {};

/** True once hydrated on the client. */
export function useMounted(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}
