"use client";

import { CameraIcon, SignOutIcon, TrashIcon, UserPlusIcon } from "@phosphor-icons/react";
import { motion } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ui-kit/confirm-dialog";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { initials } from "@/components/layout/user-menu";
import { formatTime } from "@/lib/datetime";
import { formatVND } from "@/lib/money";
import { swatchStyle } from "@/lib/palette";
import { checkIn, checkOut, deleteLesson } from "../actions";
import type { LessonView, StudentView } from "../types";
import { CaptureDialog } from "./capture-dialog";
import { LiveTimer } from "./live-timer";
import { PhotoThumb } from "./photo-lightbox";

export function CheckInPanel({
  activeLesson,
  students,
  serverNow,
}: {
  activeLesson: LessonView | null;
  students: StudentView[];
  serverNow: number;
}) {
  // Device clock correction, so the photo stamp shows server time.
  const offset = useRef(0);
  useEffect(() => {
    offset.current = serverNow - Date.now();
  }, [serverNow]);
  const getServerOffset = useCallback(() => offset.current, []);

  const [checkInFor, setCheckInFor] = useState<StudentView | null>(null);
  const [requestId, setRequestId] = useState("");
  const [checkOutOpen, setCheckOutOpen] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);
  const [pending, startTransition] = useTransition();

  function startCheckIn(student: StudentView) {
    setRequestId(crypto.randomUUID());
    setDialogKey((k) => k + 1);
    setCheckInFor(student);
  }

  if (activeLesson) {
    return (
      <>
        <motion.section
          layout
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid gap-5 rounded-3xl border border-primary/25 bg-accent p-5 sm:p-6"
        >
          <div className="flex items-start gap-4">
            <span className="hex flex size-12 shrink-0 items-center justify-center text-sm font-semibold" style={swatchStyle(activeLesson.studentColor)}>
              {initials(activeLesson.studentName)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-sm font-medium text-primary">
                <span className="relative flex size-2.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/60 motion-reduce:animate-none" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
                </span>
                Đang dạy
              </p>
              <h2 className="truncate text-xl font-semibold">{activeLesson.studentName}</h2>
              <p className="text-sm text-muted-foreground">Vào lúc {formatTime(activeLesson.checkInAt)}</p>
            </div>
            {activeLesson.checkInPhotoId && (
              <PhotoThumb
                id={activeLesson.checkInPhotoId}
                src={`/api/photos/${activeLesson.checkInPhotoId}`}
                caption={`Check-in ${formatTime(activeLesson.checkInAt)}, ${activeLesson.studentName}`}
                label="Vào"
                className="size-16 shrink-0"
              />
            )}
          </div>
          <LiveTimer since={activeLesson.checkInAt} className="text-center text-5xl font-bold tracking-tight sm:text-6xl" />
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <Button
              size="lg"
              onClick={() => {
                setDialogKey((k) => k + 1);
                setCheckOutOpen(true);
              }}
            >
              <SignOutIcon className="size-5" /> Check-out
            </Button>
            <Button variant="ghost" size="lg" disabled={pending} onClick={() => setConfirmCancel(true)}>
              <TrashIcon className="size-5" /> Hủy buổi này
            </Button>
          </div>
        </motion.section>

        <CaptureDialog
          key={`out-${dialogKey}`}
          open={checkOutOpen}
          onOpenChange={setCheckOutOpen}
          title={`Check-out: ${activeLesson.studentName}`}
          description="Chụp một ảnh lúc kết thúc buổi học."
          stampLabel="CHECK-OUT"
          studentName={activeLesson.studentName}
          getServerOffset={getServerOffset}
          submitLabel={(t) => `Check-out lúc ${t}`}
          extra={
            <div className="grid gap-2">
              <Label htmlFor="lessonNote" className="text-[13px] text-muted-foreground">
                Hôm nay học gì? (phụ huynh sẽ thấy)
              </Label>
              <Textarea id="lessonNote" name="lessonNote" rows={3} maxLength={1000} placeholder="Ví dụ: ôn phân số, làm bài 1–5 trang 34. Bài về nhà: bài 6–8." />
            </div>
          }
          onSubmit={async (data) => {
            data.set("lessonId", activeLesson.id);
            const result = await checkOut(data);
            if (result.ok) toast.success("Đã check-out", { description: `Kết thúc buổi dạy ${activeLesson.studentName}.` });
            return result;
          }}
        />
        <ConfirmDialog
          open={confirmCancel}
          onOpenChange={setConfirmCancel}
          title="Hủy buổi dạy đang diễn ra?"
          description="Buổi này và ảnh check-in sẽ bị xóa, như chưa từng check-in."
          confirmLabel="Hủy buổi"
          onConfirm={() =>
            startTransition(async () => {
              const result = await deleteLesson({ id: activeLesson.id });
              if (!result.ok) toast.error(result.error);
              else toast.success("Đã hủy buổi dạy");
            })
          }
        />
      </>
    );
  }

  if (!students.length) {
    return (
      <EmptyState
        icon={<UserPlusIcon weight="duotone" />}
        title="Chưa có học sinh nào"
        description="Thêm học sinh cùng học phí mỗi buổi, rồi quay lại đây để check-in."
        action={
          <Button asChild>
            <Link href="/tutoring/students" transitionTypes={["nav"]}>
              Thêm học sinh
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <section className="grid gap-3">
      <h2 className="font-semibold">Bắt đầu buổi dạy</h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {students.map((student, i) => (
          <motion.li key={student.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
            <button
              type="button"
              onClick={() => startCheckIn(student)}
              className="grid w-full justify-items-center gap-2.5 rounded-2xl border bg-card px-3 py-5 text-center transition-[border-color,transform] hover:border-primary/40 active:scale-[0.98]"
            >
              <span className="hex flex size-14 items-center justify-center text-base font-semibold" style={swatchStyle(student.color)}>
                {initials(student.name)}
              </span>
              <span className="w-full">
                <span className="block truncate font-semibold">{student.name}</span>
                <span data-money className="block text-[13px] text-muted-foreground">
                  {formatVND(student.ratePerSession)}/buổi
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                <CameraIcon className="size-3.5" /> Check-in
              </span>
            </button>
          </motion.li>
        ))}
      </ul>

      {checkInFor && (
        <CaptureDialog
          key={`in-${dialogKey}`}
          open={!!checkInFor}
          onOpenChange={(o) => !o && setCheckInFor(null)}
          title={`Check-in: ${checkInFor.name}`}
          description={`Học phí buổi này: ${formatVND(checkInFor.ratePerSession)}. Chụp một ảnh khi bắt đầu dạy.`}
          stampLabel="CHECK-IN"
          studentName={checkInFor.name}
          getServerOffset={getServerOffset}
          submitLabel={(t) => `Check-in lúc ${t}`}
          onSubmit={async (data) => {
            data.set("studentId", checkInFor.id);
            data.set("clientRequestId", requestId);
            const result = await checkIn(data);
            if (result.ok) toast.success("Đã check-in", { description: `Bắt đầu buổi dạy ${checkInFor.name}.` });
            return result;
          }}
        />
      )}
    </section>
  );
}
