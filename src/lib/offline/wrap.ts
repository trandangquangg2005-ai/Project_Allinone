"use client";

import type { ActionResult } from "@/lib/action-result";
import { enqueue } from "./queue";

export type OfflineResult<T> = ActionResult<T> & { queued?: boolean };

/** A Server Action reached over the network; offline it throws before any request lands. */
function isOffline(error: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  return error instanceof TypeError; // "Failed to fetch" / "Load failed"
}

/**
 * Wraps a Server Action so a lost connection is not a lost entry: the call is
 * tried first, and only a network failure sends it to the queue. Anything the
 * server actually answered — a validation error, a permission error — comes
 * back unchanged, because retrying it later would fail the same way.
 */
export function queued<I, T>(name: string, label: string, action: (input: I) => Promise<ActionResult<T>>) {
  return async (input: I): Promise<OfflineResult<T>> => {
    try {
      return await action(input);
    } catch (error) {
      if (!isOffline(error)) throw error;
      await enqueue({ name, label, payload: input });
      return { ok: true, data: null as T, queued: true };
    }
  };
}

/** Same idea for the two photo actions, whose input is FormData. */
export function queuedForm<T>(name: string, label: string, action: (form: FormData) => Promise<ActionResult<T>>) {
  return async (form: FormData): Promise<OfflineResult<T>> => {
    try {
      return await action(form);
    } catch (error) {
      if (!isOffline(error)) throw error;
      const photo = form.get("photo");
      const payload = Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string"));
      await enqueue({
        name,
        label,
        payload,
        file: photo instanceof File ? photo : undefined,
        fileName: photo instanceof File ? photo.name : undefined,
      });
      return { ok: true, data: null as T, queued: true };
    }
  };
}
