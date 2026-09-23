"use client";

import { randomId } from "@/lib/browser";
import { idb, idbSupported, META, QUEUE } from "./idb";

/**
 * Writes made while offline wait here until the network comes back.
 *
 * Each op carries its own id, which the server remembers, so replaying a
 * batch whose reply was lost cannot create the same transaction twice.
 * `ownerId` pins the op to the account it was written for: a queued write
 * never lands in a different account, even if someone else logs in first.
 */
export type QueuedOp = {
  id: string;
  name: string;
  ownerId: string;
  payload: unknown;
  /** Photo for check-in / check-out. */
  file?: Blob;
  fileName?: string;
  /** Short Vietnamese description shown in the pending list. */
  label: string;
  createdAt: number;
  attempts: number;
  lastError?: string;
};

export type OfflineState = {
  online: boolean;
  syncing: boolean;
  pending: QueuedOp[];
  /** Ops the server rejected; they need a decision from the user. */
  failed: QueuedOp[];
};

const MAX_ATTEMPTS = 5;
const BATCH = 8;

const listeners = new Set<() => void>();
let state: OfflineState = { online: true, syncing: false, pending: [], failed: [] };
let ownerId: string | null = null;
let loaded = false;
let flushing = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

function notify() {
  for (const listener of listeners) listener();
}

function setState(next: Partial<OfflineState>) {
  state = { ...state, ...next };
  notify();
}

export function getOfflineState(): OfflineState {
  return state;
}

export function subscribeOffline(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function readAll(): Promise<QueuedOp[]> {
  if (!idbSupported()) return [];
  try {
    const ops = await idb.getAll<QueuedOp>(QUEUE);
    return ops.filter((op) => op.ownerId === ownerId).sort((a, b) => a.createdAt - b.createdAt);
  } catch {
    return [];
  }
}

async function refresh() {
  const ops = await readAll();
  setState({
    pending: ops.filter((op) => op.attempts < MAX_ATTEMPTS),
    failed: ops.filter((op) => op.attempts >= MAX_ATTEMPTS),
  });
}

/**
 * Called once per session with the signed-in account. Caches and queued work
 * belong to one account at a time; when a different person signs in on the
 * same device the caches are dropped, but their unsent writes are kept.
 */
export async function initOffline(userId: string): Promise<void> {
  ownerId = userId;
  setState({ online: navigator.onLine });
  if (!loaded) {
    loaded = true;
    window.addEventListener("online", () => {
      setState({ online: true });
      void flush();
    });
    window.addEventListener("offline", () => setState({ online: false }));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void flush();
    });
  }
  if (idbSupported()) {
    try {
      const previous = await idb.get<string>(META, "owner");
      if (previous && previous !== userId) await dropCaches();
      await idb.put(META, userId, "owner");
    } catch {
      // A private window may refuse IndexedDB; the app still works online.
    }
  }
  await refresh();
  void flush();
}

/** Pages of another account must not stay readable after a switch. */
async function dropCaches() {
  if (typeof caches === "undefined") return;
  try {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("aio-")).map((key) => caches.delete(key)));
  } catch {
    // Nothing to do; the cache is best-effort.
  }
}

export async function enqueue(op: Omit<QueuedOp, "id" | "ownerId" | "createdAt" | "attempts">): Promise<void> {
  if (!ownerId) throw new Error("offline queue not initialised");
  const record: QueuedOp = { ...op, id: randomId(), ownerId, createdAt: Date.now(), attempts: 0 };
  await idb.put(QUEUE, record);
  await refresh();
  void flush();
}

export async function discard(id: string): Promise<void> {
  await idb.delete(QUEUE, id);
  await refresh();
}

/** Puts a rejected op back in line so the user can try again after a fix. */
export async function retry(id: string): Promise<void> {
  const op = await idb.get<QueuedOp>(QUEUE, id);
  if (!op) return;
  await idb.put(QUEUE, { ...op, attempts: 0, lastError: undefined });
  await refresh();
  void flush();
}

/** 30s, 1m, 2m, 4m, then every 8 minutes: a server that is unreachable while
 *  the device thinks it is online must not be poked once a minute forever. */
const BACKOFF_MS = [30_000, 60_000, 120_000, 240_000, 480_000];
let misses = 0;

function scheduleRetry() {
  if (retryTimer) clearTimeout(retryTimer);
  const delay = BACKOFF_MS[Math.min(misses, BACKOFF_MS.length - 1)];
  misses += 1;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void flush();
  }, delay);
}

/**
 * Sends everything waiting, oldest first, in batches. Called on reconnect, on
 * returning to the tab and right after a write — never on a timer, because a
 * poll would keep the database awake and burn the monthly compute budget.
 */
export async function flush(): Promise<{ sent: number } | null> {
  if (flushing || !ownerId || typeof navigator === "undefined" || !navigator.onLine) return null;
  // Claimed before the first await: reconnecting also fires a visibility
  // change, and two overlapping flushes would send the same op twice.
  flushing = true;
  let sent = 0;
  try {
    const all = await readAll();
    const ready = all.filter((op) => op.attempts < MAX_ATTEMPTS);
    if (!ready.length) return null;
    setState({ syncing: true });
    for (let i = 0; i < ready.length; i += BATCH) {
      const batch = ready.slice(i, i + BATCH);
      const form = new FormData();
      form.set(
        "ops",
        JSON.stringify(batch.map(({ id, name, ownerId: owner, payload }) => ({ id, name, ownerId: owner, payload }))),
      );
      for (const op of batch) {
        if (op.file) form.set(`file:${op.id}`, op.file, op.fileName ?? "photo.webp");
      }

      const response = await fetch("/api/sync", { method: "POST", body: form });
      if (response.status === 401) {
        // Signed out: keep everything and let the next sign-in send it.
        scheduleRetry();
        break;
      }
      if (!response.ok) throw new Error(`sync failed: ${response.status}`);
      const body = (await response.json()) as { results: { id: string; ok: boolean; error?: string }[] };

      for (const result of body.results) {
        const op = batch.find((candidate) => candidate.id === result.id);
        if (!op) continue;
        if (result.ok) {
          await idb.delete(QUEUE, op.id);
          sent += 1;
        } else {
          await idb.put(QUEUE, { ...op, attempts: op.attempts + 1, lastError: result.error });
        }
      }
      misses = 0; // the server answered, so the connection is back
      await refresh();
    }
  } catch {
    // Still offline or the server is unreachable: try again, less and less often.
    scheduleRetry();
  } finally {
    flushing = false;
    setState({ syncing: false });
    await refresh();
  }
  return { sent };
}
