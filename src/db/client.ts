import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Framework-free pieces shared by the app, scripts and tests.

export function createPool(connectionString: string | undefined, max = 10) {
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set (see .env.example)");
  }
  const pool = new Pool({
    connectionString,
    // pg ignores `channel_binding` in the URL; enable SCRAM-SHA-256-PLUS here.
    enableChannelBinding: true,
    max,
    idleTimeoutMillis: 30_000,
    // Fail fast instead of waiting forever when the pool is exhausted.
    connectionTimeoutMillis: 10_000,
  });
  // Neon drops idle connections (it suspends the compute after a few minutes).
  // Without this listener that 'error' event is an uncaught exception and takes
  // the whole server process down; pg discards the broken client by itself.
  pool.on("error", (error) => {
    console.error("[db] idle client error", error instanceof Error ? error.message : error);
  });
  return pool;
}

export function createDb(pool: Pool) {
  return drizzle({ client: pool, schema, casing: "snake_case" });
}

export type Db = ReturnType<typeof createDb>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Run `fn` in a transaction whose RLS context is `userId`. Pass `tx` down to
 * helpers instead of nesting another withTenant: a nested call would take a
 * second pooled connection and could not see this transaction's writes.
 */
export function runAsTenant<T>(db: Db, userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.user_id', ${userId}, true)`);
    return fn(tx);
  });
}

/** Transaction-local custom settings, e.g. app.share_token_hash. */
export async function setLocal(tx: Tx, settings: Record<string, string>) {
  for (const [key, value] of Object.entries(settings)) {
    await tx.execute(sql`select set_config(${key}, ${value}, true)`);
  }
}
