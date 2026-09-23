import { z } from "zod";
import { isValidDate } from "@/lib/datetime";
import { MAX_AMOUNT } from "@/lib/money";
import { SWATCHES } from "@/lib/palette";

export const idSchema = z.uuid("Không tìm thấy dữ liệu.");
const date = z.string().refine(isValidDate, "Ngày không hợp lệ.");
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Giờ không hợp lệ.");
const fee = z
  .number({ error: "Nhập số tiền." })
  .int()
  .min(0, "Số tiền không được âm.")
  .max(MAX_AMOUNT, "Số tiền quá lớn.");
const text = (max: number, label: string) => z.string().trim().max(max, `${label} tối đa ${max} ký tự.`).default("");

export const studentSchema = z.object({
  id: idSchema.optional(),
  name: z.string().trim().min(1, "Nhập tên học sinh.").max(60, "Tên tối đa 60 ký tự."),
  subject: text(60, "Môn học"),
  grade: text(30, "Lớp"),
  parentName: text(60, "Tên phụ huynh"),
  parentPhone: text(20, "Số điện thoại"),
  ratePerSession: fee,
  color: z.enum(SWATCHES),
  note: text(500, "Ghi chú"),
});
export type StudentInput = z.input<typeof studentSchema>;

export const archiveStudentSchema = z.object({ id: idSchema, archived: z.boolean() });

const timedLesson = {
  date,
  startTime: time,
  endTime: time,
  fee,
  lessonNote: text(1000, "Nội dung buổi học"),
  privateNote: text(500, "Ghi chú riêng"),
};
const endAfterStart = (v: { startTime: string; endTime: string }) => v.endTime > v.startTime;

export const manualLessonSchema = z
  .object({ studentId: idSchema, ...timedLesson })
  .refine(endAfterStart, { message: "Giờ kết thúc phải sau giờ bắt đầu.", path: ["endTime"] });
export type ManualLessonInput = z.input<typeof manualLessonSchema>;

export const updateLessonSchema = z
  .object({ id: idSchema, status: z.enum(["completed", "cancelled"]), ...timedLesson })
  .refine(endAfterStart, { message: "Giờ kết thúc phải sau giờ bắt đầu.", path: ["endTime"] });
export type UpdateLessonInput = z.input<typeof updateLessonSchema>;

export const lessonIdSchema = z.object({ id: idSchema });

export const paymentSchema = z.object({
  studentId: idSchema,
  amount: fee.refine((v) => v > 0, "Số tiền phải lớn hơn 0."),
  paidOn: date,
  method: z.enum(["cash", "transfer"]),
  walletId: idSchema.nullish(),
  note: text(300, "Ghi chú"),
});
export type PaymentInput = z.input<typeof paymentSchema>;

export const studentIdSchema = z.object({ studentId: idSchema });

// Check-in / check-out arrive as FormData (photo upload).
export const checkInFields = z.object({
  studentId: idSchema,
  clientRequestId: z.string().regex(/^[A-Za-z0-9-]{8,64}$/),
  deviceTime: z.coerce.date().optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

export const checkOutFields = z
  .object({
    lessonId: idSchema.optional(),
    // A lesson checked in offline has no id yet; it is found again by the id
    // the device gave the check-in, once that check-in has been sent.
    checkInRequestId: z.string().regex(/^[A-Za-z0-9-]{8,64}$/).optional(),
    deviceTime: z.coerce.date().optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    lessonNote: text(1000, "Nội dung buổi học"),
  })
  .refine((v) => v.lessonId || v.checkInRequestId, { message: "Thiếu buổi học cần check-out." });

export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
