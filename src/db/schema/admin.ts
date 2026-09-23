import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";

/**
 * Who changed whose data. Written whenever an admin acts inside another
 * account ("xem như"), plus when that mode starts and stops.
 * Not tenant data: only admins read it, through admin queries.
 * Kept deliberately small — a name, an id and a short summary.
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid().primaryKey().defaultRandom(),
    actorUserId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetUserId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    action: text().notNull(),
    detail: jsonb().$type<Record<string, unknown>>(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_log_created_idx").on(t.createdAt), index("audit_log_target_idx").on(t.targetUserId)],
);
