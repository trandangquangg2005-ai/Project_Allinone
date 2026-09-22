"use client";

import { SpinnerIcon, TrashIcon } from "@phosphor-icons/react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Field } from "@/components/form/field";
import { MoneyInput } from "@/components/form/money-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ui-kit/confirm-dialog";
import { ResponsiveDialog } from "@/components/ui-kit/responsive-dialog";
import { SegmentedControl } from "@/components/ui-kit/segmented-control";
import { toVNDate, toVNTimeInput, todayVN } from "@/lib/datetime";
import { addManualLesson, deleteLesson, updateLesson } from "../actions";
import type { LessonView } from "../types";

/** Edit a finished lesson, or add one by hand (flagged "nhập tay" for parents). */
export function LessonSheet({
  open,
  onOpenChange,
  lesson,
  manualFor,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lesson?: LessonView | null;
  manualFor?: { studentId: string; studentName: string; fee: number };
}) {
  const [date, setDate] = useState(lesson ? toVNDate(lesson.checkInAt) : todayVN());
  const [startTime, setStartTime] = useState(lesson ? toVNTimeInput(lesson.checkInAt) : "18:00");
  const [endTime, setEndTime] = useState(lesson?.checkOutAt ? toVNTimeInput(lesson.checkOutAt) : "19:30");
  const [fee, setFee] = useState<number | null>(lesson?.fee ?? manualFor?.fee ?? 0);
  const [status, setStatus] = useState<"completed" | "cancelled">(lesson?.status === "cancelled" ? "cancelled" : "completed");
  const [lessonNote, setLessonNote] = useState(lesson?.lessonNote ?? "");
  const [privateNote, setPrivateNote] = useState(lesson?.privateNote ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const common = { date, startTime, endTime, fee: fee ?? 0, lessonNote, privateNote };
      const result = lesson
        ? await updateLesson({ id: lesson.id, status, ...common })
        : await addManualLesson({ studentId: manualFor!.studentId, ...common });
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors || !Object.keys(result.fieldErrors).length) toast.error(result.error);
        return;
      }
      toast.success(lesson ? "Đã lưu buổi học" : "Đã thêm buổi học");
      onOpenChange(false);
    });
  }

  function remove() {
    if (!lesson) return;
    startTransition(async () => {
      const result = await deleteLesson({ id: lesson.id });
      if (!result.ok) return void toast.error(result.error);
      toast.success("Đã xóa buổi học");
      onOpenChange(false);
    });
  }

  return (
    <>
      <ResponsiveDialog
        open={open}
        onOpenChange={onOpenChange}
        title={lesson ? `Buổi học: ${lesson.studentName}` : `Thêm buổi: ${manualFor?.studentName}`}
        description={
          lesson
            ? "Sửa giờ hoặc học phí sẽ hiện nhãn “đã chỉnh sửa” cho phụ huynh."
            : "Dùng khi quên check-in. Phụ huynh sẽ thấy nhãn “nhập tay”."
        }
        footer={
          <div className="flex w-full items-center gap-2 sm:justify-end">
            {lesson && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setConfirmDelete(true)}
                disabled={pending}
                aria-label="Xóa buổi học"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <TrashIcon className="size-5" />
              </Button>
            )}
            <Button size="lg" className="flex-1 sm:flex-none sm:px-8" onClick={submit} disabled={pending}>
              {pending && <SpinnerIcon className="size-5 animate-spin" />}
              {lesson ? "Lưu" : "Thêm buổi học"}
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-5">
          {lesson && (
            <SegmentedControl
              value={status}
              onChange={setStatus}
              options={[
                { value: "completed", label: "Đã dạy" },
                { value: "cancelled", label: "Hủy (không tính tiền)" },
              ]}
            />
          )}
          <Field label="Ngày" htmlFor="lesson-date" error={errors.date}>
            <Input id="lesson-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Bắt đầu" htmlFor="lesson-start" error={errors.startTime}>
              <Input id="lesson-start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </Field>
            <Field label="Kết thúc" htmlFor="lesson-end" error={errors.endTime}>
              <Input id="lesson-end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </Field>
          </div>
          <Field label="Học phí buổi này" error={errors.fee} hint={status === "cancelled" ? "Buổi hủy không được tính vào học phí." : undefined}>
            <MoneyInput value={fee} onChange={setFee} />
          </Field>
          <Field label="Nội dung buổi học (phụ huynh thấy)" htmlFor="lesson-note" error={errors.lessonNote}>
            <Textarea id="lesson-note" value={lessonNote} onChange={(e) => setLessonNote(e.target.value)} rows={3} maxLength={1000} />
          </Field>
          <Field label="Ghi chú riêng (chỉ bạn thấy)" htmlFor="lesson-private" error={errors.privateNote}>
            <Textarea id="lesson-private" value={privateNote} onChange={(e) => setPrivateNote(e.target.value)} rows={2} maxLength={500} />
          </Field>
        </div>
      </ResponsiveDialog>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Xóa buổi học này?"
        description="Ảnh check-in/out của buổi cũng bị xóa. Học phí sẽ được tính lại."
        confirmLabel="Xóa"
        onConfirm={remove}
      />
    </>
  );
}
