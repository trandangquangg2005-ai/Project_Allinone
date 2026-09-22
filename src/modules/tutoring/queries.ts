import "server-only";
import { aliasedTable, and, asc, desc, eq, gte, isNull, lt, sql } from "drizzle-orm";
import type { Tx } from "@/db";
import { lessonPhotos, lessons, shareLinks, students, tuitionPayments, userSettings, wallets } from "@/db/schema";
import { decryptText } from "@/lib/crypto";
import { dayInstantRange, monthDateRange, monthInstantRange, todayVN } from "@/lib/datetime";
import type { LessonView, StudentView, TuitionPaymentView } from "./types";

// Correlated subqueries name the outer table explicitly ("students"."id"):
// join-free Drizzle selects leave columns unqualified.

function studentAggregates(month: string) {
  const { start, end } = monthInstantRange(month);
  const completed = sql`l.user_id = "students"."user_id" and l.student_id = "students"."id" and l.status = 'completed'`;
  return {
    monthLessons: sql<number>`(select count(*) from lessons l where ${completed} and l.check_in_at >= ${start} and l.check_in_at < ${end})::int`.mapWith(Number),
    monthFees: sql<number>`coalesce((select sum(l.fee) from lessons l where ${completed} and l.check_in_at >= ${start} and l.check_in_at < ${end}), 0)::bigint`.mapWith(Number),
    totalFees: sql<number>`coalesce((select sum(l.fee) from lessons l where ${completed}), 0)::bigint`.mapWith(Number),
    totalPaid: sql<number>`coalesce((select sum(p.amount) from tuition_payments p where p.user_id = "students"."user_id" and p.student_id = "students"."id"), 0)::bigint`.mapWith(Number),
  };
}

const studentColumns = {
  id: students.id,
  name: students.name,
  subject: students.subject,
  grade: students.grade,
  parentName: students.parentName,
  parentPhone: students.parentPhone,
  ratePerSession: students.ratePerSession,
  color: students.color,
  note: students.note,
  archivedAt: students.archivedAt,
};

type StudentRow = { archivedAt: Date | null; totalFees: number; totalPaid: number } & Omit<StudentView, "archived" | "balance">;

function toStudentView({ archivedAt, ...row }: StudentRow): StudentView {
  return { ...row, archived: archivedAt !== null, balance: row.totalFees - row.totalPaid };
}

export async function listStudents(tx: Tx, userId: string, month: string, { includeArchived = false } = {}): Promise<StudentView[]> {
  const rows = await tx
    .select({ ...studentColumns, ...studentAggregates(month) })
    .from(students)
    .where(and(eq(students.userId, userId), includeArchived ? undefined : isNull(students.archivedAt)))
    .orderBy(sql`"students"."archived_at" is not null`, asc(students.name));
  return rows.map(toStudentView);
}

export async function getStudent(tx: Tx, userId: string, id: string, month: string): Promise<StudentView | null> {
  const [row] = await tx
    .select({ ...studentColumns, ...studentAggregates(month) })
    .from(students)
    .where(and(eq(students.userId, userId), eq(students.id, id)))
    .limit(1);
  return row ? toStudentView(row) : null;
}

const inPhoto = aliasedTable(lessonPhotos, "in_photo");
const outPhoto = aliasedTable(lessonPhotos, "out_photo");

const lessonColumns = {
  id: lessons.id,
  studentId: lessons.studentId,
  studentName: students.name,
  studentColor: students.color,
  status: lessons.status,
  checkInAt: lessons.checkInAt,
  checkOutAt: lessons.checkOutAt,
  fee: lessons.fee,
  isManual: lessons.isManual,
  editedAt: lessons.editedAt,
  lessonNote: lessons.lessonNote,
  privateNote: lessons.privateNote,
  checkInPhotoId: inPhoto.id,
  checkOutPhotoId: outPhoto.id,
};

function lessonQuery(tx: Tx) {
  return tx
    .select(lessonColumns)
    .from(lessons)
    .innerJoin(students, and(eq(students.userId, lessons.userId), eq(students.id, lessons.studentId)))
    .leftJoin(inPhoto, and(eq(inPhoto.userId, lessons.userId), eq(inPhoto.lessonId, lessons.id), eq(inPhoto.kind, "check_in")))
    .leftJoin(outPhoto, and(eq(outPhoto.userId, lessons.userId), eq(outPhoto.lessonId, lessons.id), eq(outPhoto.kind, "check_out")));
}

type LessonRow = Awaited<ReturnType<ReturnType<typeof lessonQuery>["execute"]>>[number];

function toLessonView({ editedAt, ...row }: LessonRow): LessonView {
  return { ...row, edited: editedAt !== null };
}

export async function listLessons(
  tx: Tx,
  userId: string,
  filters: { month: string; studentId?: string },
): Promise<LessonView[]> {
  const { start, end } = monthInstantRange(filters.month);
  const rows = await lessonQuery(tx)
    .where(
      and(
        eq(lessons.userId, userId),
        gte(lessons.checkInAt, start),
        lt(lessons.checkInAt, end),
        filters.studentId ? eq(lessons.studentId, filters.studentId) : undefined,
      ),
    )
    .orderBy(desc(lessons.checkInAt));
  return rows.map(toLessonView);
}

export async function listTodayLessons(tx: Tx, userId: string): Promise<LessonView[]> {
  const { start, end } = dayInstantRange(todayVN());
  const rows = await lessonQuery(tx)
    .where(and(eq(lessons.userId, userId), gte(lessons.checkInAt, start), lt(lessons.checkInAt, end)))
    .orderBy(desc(lessons.checkInAt));
  return rows.map(toLessonView);
}

export async function getActiveLesson(tx: Tx, userId: string): Promise<LessonView | null> {
  const [row] = await lessonQuery(tx)
    .where(and(eq(lessons.userId, userId), eq(lessons.status, "in_progress")))
    .limit(1);
  return row ? toLessonView(row) : null;
}

export async function getLesson(tx: Tx, userId: string, id: string): Promise<LessonView | null> {
  const [row] = await lessonQuery(tx)
    .where(and(eq(lessons.userId, userId), eq(lessons.id, id)))
    .limit(1);
  return row ? toLessonView(row) : null;
}

export async function listPayments(
  tx: Tx,
  userId: string,
  filters: { studentId?: string; month?: string } = {},
): Promise<TuitionPaymentView[]> {
  const range = filters.month ? monthDateRange(filters.month) : null;
  return tx
    .select({
      id: tuitionPayments.id,
      studentId: tuitionPayments.studentId,
      amount: tuitionPayments.amount,
      paidOn: tuitionPayments.paidOn,
      method: tuitionPayments.method,
      note: tuitionPayments.note,
      walletName: wallets.name,
    })
    .from(tuitionPayments)
    .leftJoin(wallets, and(eq(wallets.userId, tuitionPayments.userId), eq(wallets.id, tuitionPayments.walletId)))
    .where(
      and(
        eq(tuitionPayments.userId, userId),
        filters.studentId ? eq(tuitionPayments.studentId, filters.studentId) : undefined,
        range ? gte(tuitionPayments.paidOn, range.from) : undefined,
        range ? lt(tuitionPayments.paidOn, range.to) : undefined,
      ),
    )
    .orderBy(desc(tuitionPayments.paidOn), desc(tuitionPayments.createdAt));
}

export async function monthTeachingSummary(tx: Tx, userId: string, month: string) {
  const { start, end } = monthInstantRange(month);
  const [row] = await tx
    .select({
      lessons: sql<number>`count(*) filter (where ${lessons.status} = 'completed')::int`.mapWith(Number),
      fees: sql<number>`coalesce(sum(${lessons.fee}) filter (where ${lessons.status} = 'completed'), 0)::bigint`.mapWith(Number),
      minutes: sql<number>`coalesce(sum(extract(epoch from (${lessons.checkOutAt} - ${lessons.checkInAt})) / 60) filter (where ${lessons.status} = 'completed'), 0)::int`.mapWith(Number),
    })
    .from(lessons)
    .where(and(eq(lessons.userId, userId), gte(lessons.checkInAt, start), lt(lessons.checkInAt, end)));
  return row;
}

export async function getPhotoPathname(tx: Tx, userId: string, photoId: string): Promise<string | null> {
  const [row] = await tx
    .select({ pathname: lessonPhotos.pathname })
    .from(lessonPhotos)
    .where(and(eq(lessonPhotos.userId, userId), eq(lessonPhotos.id, photoId)))
    .limit(1);
  return row?.pathname ?? null;
}

export type ShareLinkView = { token: string; createdAt: Date; lastViewedAt: Date | null };

export async function getShareLink(tx: Tx, userId: string, studentId: string): Promise<ShareLinkView | null> {
  const [row] = await tx
    .select({ cipher: shareLinks.tokenCipher, createdAt: shareLinks.createdAt, lastViewedAt: shareLinks.lastViewedAt })
    .from(shareLinks)
    .where(and(eq(shareLinks.userId, userId), eq(shareLinks.studentId, studentId), isNull(shareLinks.revokedAt)))
    .limit(1);
  if (!row) return null;
  const token = decryptText(row.cipher);
  return token ? { token, createdAt: row.createdAt, lastViewedAt: row.lastViewedAt } : null;
}

export async function getBankSettings(tx: Tx, userId: string) {
  const [row] = await tx
    .select({
      bankBin: userSettings.bankBin,
      bankAccountNumber: userSettings.bankAccountNumber,
      bankAccountName: userSettings.bankAccountName,
      tuitionAutoIncome: userSettings.tuitionAutoIncome,
    })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);
  return row ?? { bankBin: null, bankAccountNumber: null, bankAccountName: null, tuitionAutoIncome: true };
}
