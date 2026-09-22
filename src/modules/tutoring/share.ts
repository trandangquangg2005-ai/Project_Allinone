import "server-only";
import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { getDb, type Tx } from "@/db";
import { setLocal } from "@/db/client";
import { shareLinks, students, users } from "@/db/schema";
import { sha256 } from "@/lib/crypto";
import { getBankSettings, getPhotoPathname, getStudent, listLessons, listPayments } from "./queries";

const TOKEN = /^[A-Za-z0-9_-]{43}$/;

export type ShareScope = { tx: Tx; ownerId: string; studentId: string; ownerName: string };

/**
 * Runs `fn` with the RLS context of a parent link:
 *  1. only the share_links row whose hash was presented is visible;
 *  2. then app.user_id = the tutor and app.student_id = that student, so the
 *     restrictive policy hides every other student even if a query forgets.
 * Revoked links, archived students and disabled or downgraded tutors resolve to null.
 */
export async function withShareScope<T>(token: string, fn: (scope: ShareScope) => Promise<T>): Promise<T | null> {
  if (!TOKEN.test(token)) return null;
  const tokenHash = sha256(token);

  return getDb().transaction(async (tx) => {
    await setLocal(tx, { "app.share_token_hash": tokenHash });
    const [link] = await tx
      .select({ id: shareLinks.id, userId: shareLinks.userId, studentId: shareLinks.studentId })
      .from(shareLinks)
      .where(and(eq(shareLinks.tokenHash, tokenHash), isNull(shareLinks.revokedAt)))
      .limit(1);
    if (!link) return null;

    const [owner] = await tx
      .select({ status: users.status, modules: users.modules, displayName: users.displayName })
      .from(users)
      .where(eq(users.id, link.userId))
      .limit(1);
    if (!owner || owner.status !== "active" || !owner.modules.includes("tutoring")) return null;

    await setLocal(tx, { "app.user_id": link.userId, "app.student_id": link.studentId });

    const [student] = await tx
      .select({ archivedAt: students.archivedAt })
      .from(students)
      .where(and(eq(students.userId, link.userId), eq(students.id, link.studentId)))
      .limit(1);
    if (!student || student.archivedAt) return null;

    // "Last viewed" for the tutor, written at most every 10 minutes.
    await tx
      .update(shareLinks)
      .set({ lastViewedAt: new Date() })
      .where(
        and(
          eq(shareLinks.id, link.id),
          or(isNull(shareLinks.lastViewedAt), lt(shareLinks.lastViewedAt, sql`now() - interval '10 minutes'`)),
        ),
      );

    return fn({ tx, ownerId: link.userId, studentId: link.studentId, ownerName: owner.displayName });
  });
}

/** Everything the parent page shows. Private notes and GPS are never included. */
export async function loadParentView(token: string, month: string) {
  return withShareScope(token, async ({ tx, ownerId, studentId, ownerName }) => {
    const student = await getStudent(tx, ownerId, studentId, month);
    if (!student) return null;
    const [lessons, payments, bank] = [
      await listLessons(tx, ownerId, { month, studentId }),
      await listPayments(tx, ownerId, { studentId }),
      await getBankSettings(tx, ownerId),
    ];
    return {
      tutorName: ownerName,
      student: {
        name: student.name,
        subject: student.subject,
        grade: student.grade,
        ratePerSession: student.ratePerSession,
        monthLessons: student.monthLessons,
        monthFees: student.monthFees,
        totalFees: student.totalFees,
        totalPaid: student.totalPaid,
        balance: student.balance,
      },
      lessons: lessons.map((l) => ({
        id: l.id,
        status: l.status,
        checkInAt: l.checkInAt,
        checkOutAt: l.checkOutAt,
        fee: l.fee,
        isManual: l.isManual,
        edited: l.edited,
        lessonNote: l.lessonNote,
        checkInPhotoId: l.checkInPhotoId,
        checkOutPhotoId: l.checkOutPhotoId,
      })),
      payments: payments.map(({ id, amount, paidOn, method }) => ({ id, amount, paidOn, method })),
      bank:
        bank.bankBin && bank.bankAccountNumber
          ? { bin: bank.bankBin, accountNumber: bank.bankAccountNumber, accountName: bank.bankAccountName ?? "" }
          : null,
    };
  });
}

export type ParentView = NonNullable<Awaited<ReturnType<typeof loadParentView>>>;

export async function parentPhotoPathname(token: string, photoId: string): Promise<string | null> {
  const result = await withShareScope(token, ({ tx, ownerId }) => getPhotoPathname(tx, ownerId, photoId));
  return result ?? null;
}
