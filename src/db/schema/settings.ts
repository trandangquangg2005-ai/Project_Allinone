import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { tenantPolicy } from "./_policies";
import { users } from "./auth";

export const userSettings = pgTable(
  "user_settings",
  {
    userId: uuid()
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    // Bank account shown to parents as a VietQR code.
    bankBin: text(),
    bankAccountNumber: text(),
    bankAccountName: text(),
    // Record tuition payments as Finance income automatically.
    tuitionAutoIncome: boolean().notNull().default(true),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  () => [tenantPolicy()],
);
