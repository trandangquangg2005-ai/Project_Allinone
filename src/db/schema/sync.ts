import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { tenantPolicy } from "./_policies";
import { users } from "./auth";

/**
 * Operations already applied from the offline queue. A device that loses its
 * reply and retries sends the same opId, and the second attempt is ignored
 * instead of creating a duplicate transaction or lesson.
 * One short row per write; safe to prune after a few weeks.
 */
export const syncOps = pgTable(
  "sync_ops",
  {
    opId: text().primaryKey(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    action: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  () => [tenantPolicy()],
);
