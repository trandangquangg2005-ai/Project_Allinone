import { sql } from "drizzle-orm";
import { pgPolicy } from "drizzle-orm/pg-core";

/**
 * Row-level security helpers.
 *
 * The app connects as `aio_app` (no BYPASSRLS). Every request that touches
 * tenant data runs inside a transaction that first calls
 * `set_config('app.user_id', <uuid>, true)`; these policies then hide every
 * row that belongs to another account, even if a query forgets its WHERE.
 *
 * NULLIF is required: once a pooled connection has seen the setting, an unset
 * value reads back as '' instead of NULL, and ''::uuid would throw.
 */
export const currentUserId = sql`nullif(current_setting('app.user_id', true), '')::uuid`;
export const currentStudentId = sql`nullif(current_setting('app.student_id', true), '')::uuid`;
export const currentShareTokenHash = sql`nullif(current_setting('app.share_token_hash', true), '')`;

export function tenantPolicy() {
  return pgPolicy("tenant_isolation", {
    as: "permissive",
    for: "all",
    using: sql`user_id = ${currentUserId}`,
    withCheck: sql`user_id = ${currentUserId}`,
  });
}

/**
 * Parent links run with `app.student_id` set. This RESTRICTIVE policy is ANDed
 * with the tenant policy, so a parent-view query can only ever see one student
 * even if it forgets to filter. Owners never set app.student_id, so it is a
 * no-op for them.
 */
export function studentScopePolicy(column: "id" | "student_id") {
  return pgPolicy("parent_student_scope", {
    as: "restrictive",
    for: "all",
    using: sql`${currentStudentId} is null or ${sql.raw(column)} = ${currentStudentId}`,
  });
}
