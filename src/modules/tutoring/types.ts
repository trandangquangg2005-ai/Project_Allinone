export type LessonStatus = "in_progress" | "completed" | "cancelled";

export type StudentView = {
  id: string;
  name: string;
  subject: string;
  grade: string;
  parentName: string;
  parentPhone: string;
  ratePerSession: number;
  color: string;
  note: string;
  archived: boolean;
  monthLessons: number;
  monthFees: number;
  totalFees: number;
  totalPaid: number;
  /** fees − payments; negative means the parent paid in advance. */
  balance: number;
};

export type LessonView = {
  id: string;
  studentId: string;
  studentName: string;
  studentColor: string;
  status: LessonStatus;
  checkInAt: Date;
  checkOutAt: Date | null;
  fee: number;
  isManual: boolean;
  edited: boolean;
  lessonNote: string;
  privateNote: string;
  checkInPhotoId: string | null;
  checkOutPhotoId: string | null;
};

export type TuitionPaymentView = {
  id: string;
  studentId: string;
  amount: number;
  paidOn: string;
  method: "cash" | "transfer";
  note: string;
  walletName: string | null;
};

export const STATUS_LABELS: Record<LessonStatus, string> = {
  in_progress: "Đang dạy",
  completed: "Đã dạy",
  cancelled: "Đã hủy",
};

export function lessonDuration(lesson: Pick<LessonView, "checkInAt" | "checkOutAt">, now = Date.now()): number {
  const end = lesson.checkOutAt ? lesson.checkOutAt.getTime() : now;
  return Math.max(0, end - lesson.checkInAt.getTime());
}
