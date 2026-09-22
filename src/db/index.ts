import "server-only";
import { attachDatabasePool } from "@vercel/functions";
import { createDb, createPool, runAsTenant, type Db, type Tx } from "./client";

export type { Db, Tx };

const globalForDb = globalThis as unknown as { __aioDb?: Db };

/**
 * Lazily created so `next build` never needs a database connection.
 * attachDatabasePool lets Vercel Fluid compute close idle connections before
 * an instance is suspended.
 */
export function getDb(): Db {
  if (globalForDb.__aioDb) return globalForDb.__aioDb;
  const pool = createPool(process.env.DATABASE_URL);
  attachDatabasePool(pool);
  const db = createDb(pool);
  globalForDb.__aioDb = db;
  return db;
}

export function withTenant<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return runAsTenant(getDb(), userId, fn);
}
