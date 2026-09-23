import "server-only";
import { lt, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { auditLog } from "@/db/schema";

const MAX_KEYS = 6;
const MAX_TEXT = 60;
const KEEP_DAYS = 90;
/** Rough pruning: ~1 write in 50 also drops rows older than KEEP_DAYS. */
const PRUNE_CHANCE = 0.02;

const SKIP = new Set(["password", "newPassword", "confirmPassword", "photo", "token"]);

/** A short, readable trace of what was sent — never the whole payload. */
export function summarize(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (Object.keys(out).length >= MAX_KEYS) break;
    if (SKIP.has(key) || value === null || value === undefined || value === "") continue;
    if (typeof value === "string") out[key] = value.length > MAX_TEXT ? `${value.slice(0, MAX_TEXT)}…` : value;
    else if (typeof value === "number" || typeof value === "boolean") out[key] = value;
    else if (value instanceof Date) out[key] = value.toISOString().slice(0, 10);
  }
  return Object.keys(out).length ? out : null;
}

/**
 * Records an admin acting on someone else's account. Never throws: a failed
 * log must not undo a write the user already sees as done.
 */
export async function recordAudit(entry: {
  actorId: string;
  targetId: string;
  action: string;
  detail?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    const db = getDb();
    await db.insert(auditLog).values({
      actorUserId: entry.actorId,
      targetUserId: entry.targetId,
      action: entry.action,
      detail: entry.detail ?? null,
    });
    if (Math.random() < PRUNE_CHANCE) {
      await db.delete(auditLog).where(lt(auditLog.createdAt, sql`now() - interval '${sql.raw(String(KEEP_DAYS))} days'`));
    }
  } catch (error) {
    console.error("[audit]", error instanceof Error ? error.message : error);
  }
}
