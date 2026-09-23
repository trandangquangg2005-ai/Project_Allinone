"use client";

import { ArchiveIcon, ArrowCounterClockwiseIcon, SpinnerIcon } from "@phosphor-icons/react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Field } from "@/components/form/field";
import { MoneyInput } from "@/components/form/money-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ResponsiveDialog } from "@/components/ui-kit/responsive-dialog";
import { SwatchPicker } from "@/components/ui-kit/swatch-picker";
import { archiveStudent, saveStudent } from "../offline-actions";
import type { StudentView } from "../types";

export function StudentSheet({
  open,
  onOpenChange,
  student,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: StudentView | null;
}) {
  const [form, setForm] = useState({
    name: student?.name ?? "",
    subject: student?.subject ?? "",
    grade: student?.grade ?? "",
    parentName: student?.parentName ?? "",
    parentPhone: student?.parentPhone ?? "",
    color: student?.color ?? "blue",
    note: student?.note ?? "",
  });
  const [rate, setRate] = useState<number | null>(student?.ratePerSession ?? null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  function run(action: () => Promise<{ ok: boolean; error?: string; fieldErrors?: Record<string, string> }>, success: string) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors || !Object.keys(result.fieldErrors).length) toast.error(result.error);
        return;
      }
      toast.success(success);
      onOpenChange(false);
    });
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={student ? "Sửa thông tin học sinh" : "Thêm học sinh"}
      description={student ? "Đổi học phí chỉ áp dụng cho các buổi check-in sau này." : undefined}
      footer={
        <div className="flex w-full items-center gap-2 sm:justify-end">
          {student && (
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() =>
                run(
                  () => archiveStudent({ id: student.id, archived: !student.archived }),
                  student.archived ? "Đã cho học lại" : "Đã chuyển sang nghỉ học",
                )
              }
            >
              {student.archived ? <ArrowCounterClockwiseIcon className="size-4" /> : <ArchiveIcon className="size-4" />}
              {student.archived ? "Học lại" : "Nghỉ học"}
            </Button>
          )}
          <Button
            size="lg"
            className="flex-1 sm:flex-none sm:px-8"
            disabled={pending}
            onClick={() =>
              run(
                () => saveStudent({ id: student?.id, ...form, color: form.color as "blue", ratePerSession: rate ?? 0 }),
                student ? "Đã lưu học sinh" : "Đã thêm học sinh",
              )
            }
          >
            {pending && <SpinnerIcon className="size-5 animate-spin" />}
            {student ? "Lưu" : "Thêm học sinh"}
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-5">
        <Field label="Tên học sinh" htmlFor="st-name" error={errors.name}>
          <Input id="st-name" value={form.name} onChange={set("name")} maxLength={60} autoFocus={!student} />
        </Field>
        <Field label="Học phí mỗi buổi" error={errors.ratePerSession}>
          <MoneyInput value={rate} onChange={setRate} size="lg" invalid={!!errors.ratePerSession} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Môn học" htmlFor="st-subject" error={errors.subject}>
            <Input id="st-subject" value={form.subject} onChange={set("subject")} placeholder="Toán" maxLength={60} />
          </Field>
          <Field label="Lớp" htmlFor="st-grade" error={errors.grade}>
            <Input id="st-grade" value={form.grade} onChange={set("grade")} placeholder="Lớp 8" maxLength={30} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phụ huynh" htmlFor="st-parent" error={errors.parentName}>
            <Input id="st-parent" value={form.parentName} onChange={set("parentName")} placeholder="Cô Lan" maxLength={60} />
          </Field>
          <Field label="SĐT phụ huynh" htmlFor="st-phone" error={errors.parentPhone}>
            <Input id="st-phone" type="tel" inputMode="tel" value={form.parentPhone} onChange={set("parentPhone")} maxLength={20} />
          </Field>
        </div>
        <Field label="Màu nhận diện">
          <SwatchPicker value={form.color} onChange={(color) => setForm((f) => ({ ...f, color }))} />
        </Field>
        <Field label="Ghi chú (lịch học, địa chỉ…)" htmlFor="st-note" error={errors.note}>
          <Textarea id="st-note" value={form.note} onChange={set("note")} rows={2} maxLength={500} placeholder="Thứ 2, 4, 6 lúc 18h" />
        </Field>
      </div>
    </ResponsiveDialog>
  );
}
