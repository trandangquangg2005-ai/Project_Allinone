"use server";

import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { withTenant, type Tx } from "@/db";
import { lessonPhotos, lessons, shareLinks, students, transactions, tuitionPayments, wallets } from "@/db/schema";
import { createAction, createFormAction, UserError } from "@/lib/action";
import { encryptText, randomToken, sha256 } from "@/lib/crypto";
import { vnDateTime } from "@/lib/datetime";
import { deletePrivateFiles, putPrivateFile } from "@/lib/storage";
import { ensureTuitionCategory } from "@/modules/accounts/provision";
import { getBankSettings } from "./queries";
import {
  archiveStudentSchema,
  checkInFields,
  checkOutFields,
  lessonIdSchema,
  manualLessonSchema,
  MAX_PHOTO_BYTES,
  paymentSchema,
  studentIdSchema,
  studentSchema,
  updateLessonSchema,
} from "./schemas";

const guard = { module: "tutoring" } as const;

function refresh() {
  revalidatePath("/", "layout");
}

type IncomingPhoto = { data: Buffer; contentType: "image/webp" | "image/jpeg"; extension: "webp" | "jpg" };

async function readPhoto(form: FormData): Promise<IncomingPhoto> {
  const file = form.get("photo");
  if (!(file instanceof File) || file.size === 0) throw new UserError("Chưa có ảnh. Hãy chụp ảnh trước.");
  if (file.size > MAX_PHOTO_BYTES) throw new UserError("Ảnh quá lớn, hãy chụp lại.");
  const data = Buffer.from(await file.arrayBuffer());
  // Trust the bytes, not the declared type.
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return { data, contentType: "image/jpeg", extension: "jpg" };
  }
  if (data.subarray(0, 4).toString("latin1") === "RIFF" && data.subarray(8, 12).toString("latin1") === "WEBP") {
    return { data, contentType: "image/webp", extension: "webp" };
  }
  throw new UserError("Ảnh không đúng định dạng, chỉ nhận JPEG hoặc WebP.");
}

function fields(form: FormData) {
  return Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string" && v !== ""));
}

async function assertStudent(tx: Tx, userId: string, studentId: string) {
  const [student] = await tx
    .select({ id: students.id, name: students.name, rate: students.ratePerSession, archivedAt: students.archivedAt })
    .from(students)
    .where(and(eq(students.userId, userId), eq(students.id, studentId)))
    .limit(1);
  if (!student) throw new UserError("Không tìm thấy học sinh.");
  return student;
}

async function photoPathsForLessons(tx: Tx, userId: string, lessonIds: string[]) {
  if (!lessonIds.length) return [];
  const rows = await tx
    .select({ pathname: lessonPhotos.pathname })
    .from(lessonPhotos)
    .where(and(eq(lessonPhotos.userId, userId), inArray(lessonPhotos.lessonId, lessonIds)));
  return rows.map((r) => r.pathname);
}

function cleanupLater(pathnames: string[]) {
  if (!pathnames.length) return;
  after(async () => {
    try {
      await deletePrivateFiles(pathnames);
    } catch (error) {
      console.error("[storage] cleanup failed", error);
    }
  });
}

// -------------------------------------------------------------------- students

export const saveStudent = createAction(guard, studentSchema, async ({ id, ...values }, { user }) => {
  await withTenant(user.id, async (tx) => {
    if (id) {
      const updated = await tx
        .update(students)
        .set(values)
        .where(and(eq(students.userId, user.id), eq(students.id, id)))
        .returning({ id: students.id });
      if (!updated.length) throw new UserError("Không tìm thấy học sinh.");
    } else {
      await tx.insert(students).values({ ...values, userId: user.id });
    }
  });
  refresh();
  return null;
});

export const archiveStudent = createAction(guard, archiveStudentSchema, async ({ id, archived }, { user }) => {
  await withTenant(user.id, async (tx) => {
    await tx
      .update(students)
      .set({ archivedAt: archived ? new Date() : null })
      .where(and(eq(students.userId, user.id), eq(students.id, id)));
    if (archived) {
      // A student who stopped studying should not keep a working parent link.
      await tx
        .update(shareLinks)
        .set({ revokedAt: new Date() })
        .where(and(eq(shareLinks.userId, user.id), eq(shareLinks.studentId, id), isNull(shareLinks.revokedAt)));
    }
  });
  refresh();
  return null;
});

// ------------------------------------------------------------------ check-in/out

export const checkIn = createFormAction(guard, async (form, { user }) => {
  const input = checkInFields.parse(fields(form));
  const photo = await readPhoto(form);
  const uploaded: string[] = [];
  try {
    const lessonId = await withTenant(user.id, async (tx) => {
      // A retry of the same tap returns the lesson it already created.
      const [existing] = await tx
        .select({ id: lessons.id })
        .from(lessons)
        .where(and(eq(lessons.userId, user.id), eq(lessons.clientRequestId, input.clientRequestId)))
        .limit(1);
      if (existing) return existing.id;

      const student = await assertStudent(tx, user.id, input.studentId);
      if (student.archivedAt) throw new UserError("Học sinh này đã nghỉ học. Hãy mở lại trước khi check-in.");

      const [lesson] = await tx
        .insert(lessons)
        .values({
          userId: user.id,
          studentId: student.id,
          status: "in_progress",
          checkInAt: sql`now()`,
          deviceCheckInAt: input.deviceTime ?? null,
          fee: student.rate,
          checkInLat: input.lat ?? null,
          checkInLng: input.lng ?? null,
          clientRequestId: input.clientRequestId,
        })
        .returning({ id: lessons.id });

      const photoId = randomUUID();
      const pathname = `u/${user.id}/lessons/${lesson.id}/check-in-${photoId}.${photo.extension}`;
      await putPrivateFile(pathname, photo.data, photo.contentType);
      uploaded.push(pathname);
      await tx.insert(lessonPhotos).values({
        id: photoId,
        userId: user.id,
        lessonId: lesson.id,
        studentId: student.id,
        kind: "check_in",
        pathname,
        contentType: photo.contentType,
        size: photo.data.length,
      });
      return lesson.id;
    });
    refresh();
    return { lessonId };
  } catch (error) {
    cleanupLater(uploaded); // the transaction rolled back; drop the orphan file
    throw error;
  }
});

export const checkOut = createFormAction(guard, async (form, { user }) => {
  const input = checkOutFields.parse(fields(form));
  const photo = await readPhoto(form);
  const uploaded: string[] = [];
  try {
    await withTenant(user.id, async (tx) => {
      const [lesson] = await tx
        .select({ id: lessons.id, studentId: lessons.studentId, status: lessons.status })
        .from(lessons)
        .where(and(eq(lessons.userId, user.id), eq(lessons.id, input.lessonId)))
        .limit(1);
      if (!lesson) throw new UserError("Không tìm thấy buổi dạy.");
      if (lesson.status !== "in_progress") throw new UserError("Buổi này đã check-out rồi.");

      const photoId = randomUUID();
      const pathname = `u/${user.id}/lessons/${lesson.id}/check-out-${photoId}.${photo.extension}`;
      await putPrivateFile(pathname, photo.data, photo.contentType);
      uploaded.push(pathname);
      await tx.insert(lessonPhotos).values({
        id: photoId,
        userId: user.id,
        lessonId: lesson.id,
        studentId: lesson.studentId,
        kind: "check_out",
        pathname,
        contentType: photo.contentType,
        size: photo.data.length,
      });
      await tx
        .update(lessons)
        .set({
          status: "completed",
          checkOutAt: sql`now()`,
          deviceCheckOutAt: input.deviceTime ?? null,
          checkOutLat: input.lat ?? null,
          checkOutLng: input.lng ?? null,
          lessonNote: input.lessonNote,
        })
        .where(and(eq(lessons.userId, user.id), eq(lessons.id, lesson.id)));
    });
    refresh();
    return null;
  } catch (error) {
    cleanupLater(uploaded);
    throw error;
  }
});

// ----------------------------------------------------------------- lesson edits

export const addManualLesson = createAction(guard, manualLessonSchema, async (input, { user }) => {
  await withTenant(user.id, async (tx) => {
    const student = await assertStudent(tx, user.id, input.studentId);
    await tx.insert(lessons).values({
      userId: user.id,
      studentId: student.id,
      status: "completed",
      checkInAt: vnDateTime(input.date, input.startTime),
      checkOutAt: vnDateTime(input.date, input.endTime),
      fee: input.fee,
      isManual: true,
      lessonNote: input.lessonNote,
      privateNote: input.privateNote,
    });
  });
  refresh();
  return null;
});

export const updateLesson = createAction(guard, updateLessonSchema, async (input, { user }) => {
  await withTenant(user.id, async (tx) => {
    const [lesson] = await tx
      .select({ status: lessons.status, checkInAt: lessons.checkInAt, checkOutAt: lessons.checkOutAt, fee: lessons.fee })
      .from(lessons)
      .where(and(eq(lessons.userId, user.id), eq(lessons.id, input.id)))
      .limit(1);
    if (!lesson) throw new UserError("Không tìm thấy buổi dạy.");
    if (lesson.status === "in_progress") throw new UserError("Hãy check-out buổi này trước khi sửa.");

    const checkInAt = vnDateTime(input.date, input.startTime);
    const checkOutAt = vnDateTime(input.date, input.endTime);
    // Changing times or fee is shown to parents as "đã chỉnh sửa".
    const substantive =
      checkInAt.getTime() !== lesson.checkInAt.getTime() ||
      checkOutAt.getTime() !== lesson.checkOutAt?.getTime() ||
      input.fee !== lesson.fee ||
      input.status !== lesson.status;

    await tx
      .update(lessons)
      .set({
        status: input.status,
        checkInAt,
        checkOutAt,
        fee: input.fee,
        lessonNote: input.lessonNote,
        privateNote: input.privateNote,
        ...(substantive ? { editedAt: new Date() } : {}),
      })
      .where(and(eq(lessons.userId, user.id), eq(lessons.id, input.id)));
  });
  refresh();
  return null;
});

export const deleteLesson = createAction(guard, lessonIdSchema, async ({ id }, { user }) => {
  const pathnames = await withTenant(user.id, async (tx) => {
    const paths = await photoPathsForLessons(tx, user.id, [id]);
    const deleted = await tx
      .delete(lessons)
      .where(and(eq(lessons.userId, user.id), eq(lessons.id, id)))
      .returning({ id: lessons.id });
    if (!deleted.length) throw new UserError("Không tìm thấy buổi dạy.");
    return paths;
  });
  cleanupLater(pathnames);
  refresh();
  return null;
});

// --------------------------------------------------------------------- payments

export const recordPayment = createAction(guard, paymentSchema, async (input, { user }) => {
  await withTenant(user.id, async (tx) => {
    const student = await assertStudent(tx, user.id, input.studentId);
    const settings = await getBankSettings(tx, user.id);

    let transactionId: string | null = null;
    // Book the money in Finance only for accounts that have the module.
    if (user.modules.includes("finance") && settings.tuitionAutoIncome && input.walletId) {
      const [wallet] = await tx
        .select({ id: wallets.id })
        .from(wallets)
        .where(and(eq(wallets.userId, user.id), eq(wallets.id, input.walletId)))
        .limit(1);
      if (!wallet) throw new UserError("Không tìm thấy ví.");
      const categoryId = await ensureTuitionCategory(tx, user.id);
      const [movement] = await tx
        .insert(transactions)
        .values({
          userId: user.id,
          kind: "income",
          amount: input.amount,
          walletId: wallet.id,
          categoryId,
          occurredOn: input.paidOn,
          note: `Học phí ${student.name}`,
          source: "tutoring",
        })
        .returning({ id: transactions.id });
      transactionId = movement.id;
    }

    await tx.insert(tuitionPayments).values({
      userId: user.id,
      studentId: student.id,
      amount: input.amount,
      paidOn: input.paidOn,
      method: input.method,
      note: input.note,
      walletId: transactionId ? input.walletId! : null,
      transactionId,
    });
  });
  refresh();
  return null;
});

export const deletePayment = createAction(guard, lessonIdSchema, async ({ id }, { user }) => {
  await withTenant(user.id, async (tx) => {
    const [payment] = await tx
      .delete(tuitionPayments)
      .where(and(eq(tuitionPayments.userId, user.id), eq(tuitionPayments.id, id)))
      .returning({ transactionId: tuitionPayments.transactionId });
    if (!payment) throw new UserError("Không tìm thấy khoản thu.");
    if (payment.transactionId) {
      await tx
        .delete(transactions)
        .where(and(eq(transactions.userId, user.id), eq(transactions.id, payment.transactionId)));
    }
  });
  refresh();
  return null;
});

// ------------------------------------------------------------------ parent links

/** Creates the student's parent link, revoking any previous one. */
export const regenerateShareLink = createAction(guard, studentIdSchema, async ({ studentId }, { user }) => {
  const token = randomToken(32);
  await withTenant(user.id, async (tx) => {
    const student = await assertStudent(tx, user.id, studentId);
    if (student.archivedAt) throw new UserError("Học sinh đã nghỉ học nên không tạo link được.");
    await tx
      .update(shareLinks)
      .set({ revokedAt: new Date() })
      .where(and(eq(shareLinks.userId, user.id), eq(shareLinks.studentId, studentId), isNull(shareLinks.revokedAt)));
    await tx.insert(shareLinks).values({
      userId: user.id,
      studentId,
      tokenHash: sha256(token),
      tokenCipher: encryptText(token),
    });
  });
  refresh();
  return { token };
});

export const revokeShareLink = createAction(guard, studentIdSchema, async ({ studentId }, { user }) => {
  await withTenant(user.id, async (tx) => {
    await tx
      .update(shareLinks)
      .set({ revokedAt: new Date() })
      .where(and(eq(shareLinks.userId, user.id), eq(shareLinks.studentId, studentId), isNull(shareLinks.revokedAt)));
  });
  refresh();
  return null;
});
