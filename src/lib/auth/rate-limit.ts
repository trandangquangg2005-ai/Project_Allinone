import "server-only";
import { inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { loginAttempts } from "@/db/schema";

const WINDOW = "15 minutes";
const LOCK = "15 minutes";
// Per username: 5 wrong passwords. Per IP: more, since families share one IP.
const LIMITS = { user: 5, ip: 20 } as const;

export type AttemptKey = { key: string; limit: number };

export function attemptKeys(username: string, ip: string | null): AttemptKey[] {
  const keys: AttemptKey[] = [{ key: `user:${username}`, limit: LIMITS.user }];
  if (ip) keys.push({ key: `ip:${ip}`, limit: LIMITS.ip });
  return keys;
}

/** Returns the time the lock ends, or null when login may proceed. */
export async function lockedUntil(keys: AttemptKey[]): Promise<Date | null> {
  const rows = await getDb()
    .select({ lockedUntil: loginAttempts.lockedUntil })
    .from(loginAttempts)
    .where(inArray(loginAttempts.key, keys.map((k) => k.key)));
  const now = Date.now();
  const active = rows
    .map((r) => r.lockedUntil)
    .filter((d): d is Date => !!d && d.getTime() > now)
    .sort((a, b) => b.getTime() - a.getTime());
  return active[0] ?? null;
}

export async function recordFailure(keys: AttemptKey[]): Promise<void> {
  const db = getDb();
  for (const { key, limit } of keys) {
    const expired = sql`${loginAttempts.windowStart} < now() - interval '${sql.raw(WINDOW)}'`;
    const failures = sql`case when ${expired} then 1 else ${loginAttempts.failures} + 1 end`;
    await db
      .insert(loginAttempts)
      .values({ key, failures: 1 })
      .onConflictDoUpdate({
        target: loginAttempts.key,
        set: {
          failures,
          windowStart: sql`case when ${expired} then now() else ${loginAttempts.windowStart} end`,
          lockedUntil: sql`case when ${failures} >= ${limit} then now() + interval '${sql.raw(LOCK)}' else ${loginAttempts.lockedUntil} end`,
        },
      });
  }
}

export async function clearFailures(keys: AttemptKey[]): Promise<void> {
  const userKeys = keys.filter((k) => k.key.startsWith("user:")).map((k) => k.key);
  if (userKeys.length) await getDb().delete(loginAttempts).where(inArray(loginAttempts.key, userKeys));
}
