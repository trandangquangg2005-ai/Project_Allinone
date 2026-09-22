import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  doublePrecision,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { currentShareTokenHash, currentUserId, studentScopePolicy, tenantPolicy } from "./_policies";
import { users } from "./auth";
import { transactions, wallets } from "./finance";

export const lessonStatus = pgEnum("lesson_status", ["in_progress", "completed", "cancelled"]);
export const photoKind = pgEnum("photo_kind", ["check_in", "check_out"]);
export const paymentMethod = pgEnum("payment_method", ["cash", "transfer"]);

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
const money = () => bigint({ mode: "number" });

export const students = pgTable(
  "students",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: ownerId(),
    name: text().notNull(),
    subject: text().notNull().default(""),
    grade: text().notNull().default(""),
    parentName: text().notNull().default(""),
    parentPhone: text().notNull().default(""),
    ratePerSession: money().notNull().default(0),
    color: text().notNull().default("blue"),
    note: text().notNull().default(""),
    archivedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("students_user_id_id_key").on(t.userId, t.id),
    check("students_rate_non_negative", sql`${t.ratePerSession} >= 0`),
    index("students_user_idx").on(t.userId),
    tenantPolicy(),
    studentScopePolicy("id"),
  ],
);

export const lessons = pgTable(
  "lessons",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: ownerId(),
    studentId: uuid().notNull(),
    status: lessonStatus().notNull().default("in_progress"),
    // Authoritative times come from the server clock.
    checkInAt: timestamp({ withTimezone: true }).notNull(),
    checkOutAt: timestamp({ withTimezone: true }),
    // Device clock at capture time, kept for auditing drift.
    deviceCheckInAt: timestamp({ withTimezone: true }),
    deviceCheckOutAt: timestamp({ withTimezone: true }),
    // Rate snapshot taken at check-in; editable afterwards.
    fee: money().notNull().default(0),
    isManual: boolean().notNull().default(false),
    editedAt: timestamp({ withTimezone: true }),
    lessonNote: text().notNull().default(""),
    privateNote: text().notNull().default(""),
    checkInLat: doublePrecision(),
    checkInLng: doublePrecision(),
    checkOutLat: doublePrecision(),
    checkOutLng: doublePrecision(),
    // Idempotency key so a retried upload on a weak connection is not doubled.
    clientRequestId: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("lessons_user_id_id_key").on(t.userId, t.id),
    unique("lessons_user_id_id_student_key").on(t.userId, t.id, t.studentId),
    foreignKey({
      name: "lessons_student_fk",
      columns: [t.userId, t.studentId],
      foreignColumns: [students.userId, students.id],
    }),
    uniqueIndex("lessons_one_active_per_user").on(t.userId).where(sql`${t.status} = 'in_progress'`),
    uniqueIndex("lessons_client_request_key")
      .on(t.userId, t.clientRequestId)
      .where(sql`${t.clientRequestId} is not null`),
    check("lessons_fee_non_negative", sql`${t.fee} >= 0`),
    check("lessons_checkout_after_checkin", sql`${t.checkOutAt} is null or ${t.checkOutAt} >= ${t.checkInAt}`),
    check("lessons_completed_has_checkout", sql`${t.status} <> 'completed' or ${t.checkOutAt} is not null`),
    index("lessons_user_checkin_idx").on(t.userId, t.checkInAt),
    index("lessons_user_student_checkin_idx").on(t.userId, t.studentId, t.checkInAt),
    tenantPolicy(),
    studentScopePolicy("student_id"),
  ],
);

export const lessonPhotos = pgTable(
  "lesson_photos",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: ownerId(),
    lessonId: uuid().notNull(),
    // Denormalised so the parent-scope policy can filter photos directly.
    studentId: uuid().notNull(),
    kind: photoKind().notNull(),
    pathname: text().notNull(),
    contentType: text().notNull().default("image/jpeg"),
    size: integer().notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      name: "lesson_photos_lesson_fk",
      columns: [t.userId, t.lessonId, t.studentId],
      foreignColumns: [lessons.userId, lessons.id, lessons.studentId],
    }).onDelete("cascade"),
    uniqueIndex("lesson_photos_lesson_kind_key").on(t.lessonId, t.kind),
    tenantPolicy(),
    studentScopePolicy("student_id"),
  ],
);

export const tuitionPayments = pgTable(
  "tuition_payments",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: ownerId(),
    studentId: uuid().notNull(),
    amount: money().notNull(),
    paidOn: date({ mode: "string" }).notNull(),
    method: paymentMethod().notNull().default("transfer"),
    note: text().notNull().default(""),
    // Linked Finance income, created in the same transaction.
    walletId: uuid(),
    transactionId: uuid(),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      name: "tuition_payments_student_fk",
      columns: [t.userId, t.studentId],
      foreignColumns: [students.userId, students.id],
    }),
    foreignKey({
      name: "tuition_payments_wallet_fk",
      columns: [t.userId, t.walletId],
      foreignColumns: [wallets.userId, wallets.id],
    }),
    foreignKey({
      name: "tuition_payments_transaction_fk",
      columns: [t.userId, t.transactionId],
      foreignColumns: [transactions.userId, transactions.id],
    }),
    check("tuition_payments_amount_positive", sql`${t.amount} > 0`),
    index("tuition_payments_user_student_idx").on(t.userId, t.studentId, t.paidOn),
    tenantPolicy(),
    studentScopePolicy("student_id"),
  ],
);

// Parent links. Only the SHA-256 of the token is searchable; the token itself
// is kept AES-GCM encrypted so the owner can copy the link again later.
export const shareLinks = pgTable(
  "share_links",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: ownerId(),
    studentId: uuid().notNull(),
    tokenHash: text().notNull().unique(),
    tokenCipher: text().notNull(),
    createdAt: createdAt(),
    revokedAt: timestamp({ withTimezone: true }),
    lastViewedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    foreignKey({
      name: "share_links_student_fk",
      columns: [t.userId, t.studentId],
      foreignColumns: [students.userId, students.id],
    }).onDelete("cascade"),
    uniqueIndex("share_links_one_active_per_student")
      .on(t.userId, t.studentId)
      .where(sql`${t.revokedAt} is null`),
    // Owners see their own links; a parent request may only see the one row
    // whose hash it presented (app.share_token_hash), before app.user_id is known.
    pgPolicy("share_link_access", {
      as: "permissive",
      for: "all",
      using: sql`user_id = ${currentUserId} or token_hash = ${currentShareTokenHash}`,
      withCheck: sql`user_id = ${currentUserId}`,
    }),
  ],
);

export type LessonStatus = (typeof lessonStatus.enumValues)[number];
