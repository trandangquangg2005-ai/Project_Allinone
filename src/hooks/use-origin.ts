"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** window.location.origin after hydration ("" during SSR), without a mismatch. */
export function useOrigin(): string {
  return useSyncExternalStore(noop, () => window.location.origin, () => "");
}
