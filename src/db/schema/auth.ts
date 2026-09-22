import { sql } from "drizzle-orm";
import { boolean, check, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["admin", "user"]);
export const userStatus = pgEnum("user_status", ["active", "disabled"]);

// Not tenant data: login has to look users up before anyone is authenticated,
// and admins manage accounts. It holds no finance/tutoring data.
export const users = pgTable(
  "users",
  {
    id: uuid().primaryKey().defaultRandom(),
    username: text().notNull().unique(),
    displayName: text().notNull(),
    passwordHash: text().notNull(),
    role: userRole().notNull().default("user"),
    modules: text().array().notNull().default(sql`'{}'::text[]`),
    status: userStatus().notNull().default("active"),
    mustChangePassword: boolean().notNull().default(true),
    // Bumped on password change/reset, disable and "log out everywhere";
    // sessions carrying an older value are rejected.
    sessionVersion: integer().notNull().default(1),
    lastLoginAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [check("users_username_format", sql`${t.username} ~ '^[a-z0-9._-]{3,32}$'`)],
);

export const loginAttempts = pgTable("login_attempts", {
  key: text().primaryKey(),
  failures: integer().notNull().default(0),
  windowStart: timestamp({ withTimezone: true }).notNull().defaultNow(),
  lockedUntil: timestamp({ withTimezone: true }),
});
