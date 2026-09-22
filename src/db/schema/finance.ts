import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  date,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { tenantPolicy } from "./_policies";
import { users } from "./auth";

export const walletKind = pgEnum("wallet_kind", ["cash", "bank", "ewallet", "other"]);
export const categoryKind = pgEnum("category_kind", ["income", "expense"]);
export const txKind = pgEnum("tx_kind", ["income", "expense", "transfer"]);
export const txSource = pgEnum("tx_source", ["manual", "tutoring", "debt"]);
export const debtDirection = pgEnum("debt_direction", ["lent", "borrowed"]);

const ownerId = () =>
  uuid()
    .notNull()
    .references(() => users.id, { onDelete: "cascade" });
const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
// VND has no minor unit; store whole đồng. JS numbers are exact up to 9e15.
const money = () => bigint({ mode: "number" });

// Every child table references its parent through (user_id, id). Foreign-key
// checks bypass RLS, so a single-column FK would let one account point a row
// at another account's wallet/category/student.

export const wallets = pgTable(
  "wallets",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: ownerId(),
    name: text().notNull(),
    kind: walletKind().notNull().default("cash"),
    openingBalance: money().notNull().default(0),
    color: text().notNull().default("blue"),
    sortOrder: integer().notNull().default(0),
    archivedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    unique("wallets_user_id_id_key").on(t.userId, t.id),
    uniqueIndex("wallets_user_name_key").on(t.userId, t.name).where(sql`${t.archivedAt} is null`),
    tenantPolicy(),
  ],
);

export const categories = pgTable(
  "categories",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: ownerId(),
    kind: categoryKind().notNull(),
    name: text().notNull(),
    icon: text().notNull().default("tag"),
    color: text().notNull().default("slate"),
    // Stable key for categories the app itself relies on (e.g. "tuition").
    systemKey: text(),
    sortOrder: integer().notNull().default(0),
    archivedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    unique("categories_user_id_id_key").on(t.userId, t.id),
    uniqueIndex("categories_user_kind_name_key")
      .on(t.userId, t.kind, t.name)
      .where(sql`${t.archivedAt} is null`),
    uniqueIndex("categories_user_system_key")
      .on(t.userId, t.systemKey)
      .where(sql`${t.systemKey} is not null`),
    tenantPolicy(),
  ],
);

export const transactions = pgTable(
  "transactions",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: ownerId(),
    kind: txKind().notNull(),
    amount: money().notNull(),
    walletId: uuid().notNull(),
    toWalletId: uuid(),
    categoryId: uuid(),
    // Calendar date in Vietnam time; reports are plain date ranges.
    occurredOn: date({ mode: "string" }).notNull(),
    note: text().notNull().default(""),
    // "tutoring" and "debt" rows are created and removed by those features.
    source: txSource().notNull().default("manual"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("transactions_user_id_id_key").on(t.userId, t.id),
    foreignKey({
      name: "transactions_wallet_fk",
      columns: [t.userId, t.walletId],
      foreignColumns: [wallets.userId, wallets.id],
    }),
    foreignKey({
      name: "transactions_to_wallet_fk",
      columns: [t.userId, t.toWalletId],
      foreignColumns: [wallets.userId, wallets.id],
    }),
    foreignKey({
      name: "transactions_category_fk",
      columns: [t.userId, t.categoryId],
      foreignColumns: [categories.userId, categories.id],
    }),
    check("transactions_amount_positive", sql`${t.amount} > 0`),
    check(
      "transactions_shape",
      sql`(${t.kind} = 'transfer' and ${t.toWalletId} is not null and ${t.toWalletId} <> ${t.walletId} and ${t.categoryId} is null)
        or (${t.kind} <> 'transfer' and ${t.toWalletId} is null and (${t.categoryId} is not null or ${t.source} = 'debt'))`,
    ),
    index("transactions_user_date_idx").on(t.userId, t.occurredOn),
    index("transactions_user_wallet_idx").on(t.userId, t.walletId),
    index("transactions_user_to_wallet_idx").on(t.userId, t.toWalletId),
    index("transactions_user_category_idx").on(t.userId, t.categoryId),
    tenantPolicy(),
  ],
);

export const debts = pgTable(
  "debts",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: ownerId(),
    // lent = they owe me (cần đòi), borrowed = I owe them (phải trả)
    direction: debtDirection().notNull(),
    counterparty: text().notNull(),
    phone: text().notNull().default(""),
    principal: money().notNull(),
    occurredOn: date({ mode: "string" }).notNull(),
    dueOn: date({ mode: "string" }),
    note: text().notNull().default(""),
    // Optional wallet movement recorded when the debt was created.
    walletId: uuid(),
    transactionId: uuid(),
    settledAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("debts_user_id_id_key").on(t.userId, t.id),
    foreignKey({
      name: "debts_wallet_fk",
      columns: [t.userId, t.walletId],
      foreignColumns: [wallets.userId, wallets.id],
    }),
    foreignKey({
      name: "debts_transaction_fk",
      columns: [t.userId, t.transactionId],
      foreignColumns: [transactions.userId, transactions.id],
    }),
    check("debts_principal_positive", sql`${t.principal} > 0`),
    index("debts_user_direction_idx").on(t.userId, t.direction),
    tenantPolicy(),
  ],
);

export const debtPayments = pgTable(
  "debt_payments",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: ownerId(),
    debtId: uuid().notNull(),
    amount: money().notNull(),
    paidOn: date({ mode: "string" }).notNull(),
    note: text().notNull().default(""),
    walletId: uuid(),
    transactionId: uuid(),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      name: "debt_payments_debt_fk",
      columns: [t.userId, t.debtId],
      foreignColumns: [debts.userId, debts.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "debt_payments_wallet_fk",
      columns: [t.userId, t.walletId],
      foreignColumns: [wallets.userId, wallets.id],
    }),
    foreignKey({
      name: "debt_payments_transaction_fk",
      columns: [t.userId, t.transactionId],
      foreignColumns: [transactions.userId, transactions.id],
    }),
    check("debt_payments_amount_positive", sql`${t.amount} > 0`),
    index("debt_payments_debt_idx").on(t.userId, t.debtId),
    tenantPolicy(),
  ],
);
