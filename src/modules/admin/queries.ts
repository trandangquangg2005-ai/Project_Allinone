import "server-only";
import { alias } from "drizzle-orm/pg-core";
import { asc, desc, eq, sql } from "drizzle-orm";
import { isModuleKey, type ModuleKey } from "@/config/modules";
import { getDb } from "@/db";
import { auditLog, users } from "@/db/schema";

export type AccountView = {
  id: string;
  username: string;
  displayName: string;
  role: "admin" | "user";
  modules: ModuleKey[];
  status: "active" | "disabled";
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
};

/** Account metadata only; nothing from any account's own data. */
export async function listAccounts(): Promise<AccountView[]> {
  const rows = await getDb()
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      role: users.role,
      modules: users.modules,
      status: users.status,
      mustChangePassword: users.mustChangePassword,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(sql`${users.status} = 'disabled'`, asc(users.createdAt));
  return rows.map((r) => ({ ...r, modules: r.modules.filter(isModuleKey) }));
}

export type AuditEntry = {
  id: string;
  action: string;
  detail: Record<string, unknown> | null;
  createdAt: Date;
  actorName: string;
  targetName: string;
};

/** Newest first; the admin screen shows the most recent page only. */
export async function listAudit(limit = 60): Promise<AuditEntry[]> {
  const actor = alias(users, "actor");
  const target = alias(users, "target");
  return getDb()
    .select({
      id: auditLog.id,
      action: auditLog.action,
      detail: auditLog.detail,
      createdAt: auditLog.createdAt,
      actorName: actor.username,
      targetName: target.username,
    })
    .from(auditLog)
    .innerJoin(actor, eq(actor.id, auditLog.actorUserId))
    .innerJoin(target, eq(target.id, auditLog.targetUserId))
    .orderBy(desc(auditLog.createdAt))
    .limit(limit);
}

/**
 * Neon's free plan stops accepting writes at 0.5 GB, so the number is worth
 * having in plain sight. One cheap query, only when this page is opened.
 */
export async function getStorageUsage(): Promise<{ bytes: number; limit: number }> {
  const result = await getDb().execute<{ size: string }>(sql`select pg_database_size(current_database())::text as size`);
  return { bytes: Number(result.rows[0]?.size ?? 0), limit: 512 * 1024 * 1024 };
}
