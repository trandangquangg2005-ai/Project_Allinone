"use client";

import { CameraIcon, SignOutIcon, TrashIcon, UserPlusIcon } from "@phosphor-icons/react";
import { motion } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ui-kit/confirm-dialog";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { initials } from "@/components/layout/user-menu";
import { randomId } from "@/lib/browser";
import { formatTime } from "@/lib/datetime";
import { formatVND } from "@/lib/money";
import { discard, getOfflineState, subscribeOffline, type OfflineState } from "@/lib/offline/queue";
import { swatchStyle } from "@/lib/palette";
import { checkIn, checkOut, deleteLesson } from "../offline-actions";
import type { LessonView, StudentView } from "../types";
import { CaptureDialog } from "./capture-dialog";
import { LiveTimer } from "./live-timer";
import { PhotoThumb } from "./photo-lightbox";

const EMPTY_OFFLINE: OfflineState = { online: true, syncing: false, pending: [], failed: [] };

type CheckInPayload = { studentId: string; clientRequestId: string; deviceTime?: string };
type CheckOutPayload = { checkInRequestId?: string };

/** The photo as it sits in the queue, before it has been uploaded. */
function LocalPhoto({ file }: { file: Blob }) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a blob: URL from this device, not a remote image
    <img src={url} alt="Ảnh check-in chờ gửi" className="size-16 shrink-0 rounded-xl object-cover" />
  );
}

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
    setRequestId(randomId());
    setDialogKey((k) => k + 1);
    setCheckInFor(student);
  }

  // A check-in that has not reached the server yet still counts as a lesson in
  // progress: the card below is built from the queue instead of from the page.
  const offline = useSyncExternalStore(subscribeOffline, getOfflineState, () => EMPTY_OFFLINE);
  const queuedLesson = useMemo(() => {
    const closed = new Set(
      offline.pending.filter((op) => op.name === "checkOut").map((op) => (op.payload as CheckOutPayload).checkInRequestId),
    );
    return offline.pending.find(
      (op) => op.name === "checkIn" && !closed.has((op.payload as CheckInPayload).clientRequestId),
    );
  }, [offline.pending]);

  const current = activeLesson
    ? {
        name: activeLesson.studentName,
        color: activeLesson.studentColor,
        since: activeLesson.checkInAt,
        lessonId: activeLesson.id,
        requestId: "",
        queuedId: null,
        queued: false,
        photo: activeLesson.checkInPhotoId ? (
          <PhotoThumb
            id={activeLesson.checkInPhotoId}
            src={`/api/photos/${activeLesson.checkInPhotoId}`}
            caption={`Check-in ${formatTime(activeLesson.checkInAt)}, ${activeLesson.studentName}`}
            label="Vào"
            className="size-16 shrink-0"
          />
        ) : null,
      }
    : queuedLesson
      ? (() => {
          const payload = queuedLesson.payload as CheckInPayload;
          const student = students.find((s) => s.id === payload.studentId);
          return {
            name: student?.name ?? "Học sinh",
            color: student?.color ?? "slate",
            since: new Date(payload.deviceTime ?? queuedLesson.createdAt),
            lessonId: null,
            requestId: payload.clientRequestId,
            queuedId: queuedLesson.id,
            queued: true,
            photo: queuedLesson.file ? <LocalPhoto file={queuedLesson.file} /> : null,
          };
        })()
      : null;

  if (current) {
    return (
      <>
        <motion.section
          layout
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid gap-5 rounded-3xl border border-primary/25 bg-accent p-5 sm:p-6"
        >
          <div className="flex items-start gap-4">
            <span className="hex flex size-12 shrink-0 items-center justify-center text-sm font-semibold" style={swatchStyle(current.color)}>
              {initials(current.name)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-sm font-medium text-primary">
                <span className="relative flex size-2.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/60 motion-reduce:animate-none" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
                </span>
                Đang dạy
                {current.queued && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px]">chờ gửi</span>}
              </p>
              <h2 className="truncate text-xl font-semibold">{current.name}</h2>
              <p className="text-sm text-muted-foreground">Vào lúc {formatTime(current.since)}</p>
            </div>
            {current.photo}
          </div>
          <LiveTimer since={current.since} className="text-center text-5xl font-bold tracking-tight sm:text-6xl" />
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
          title={`Check-out: ${current.name}`}
          description="Chụp một ảnh lúc kết thúc buổi học."
          stampLabel="CHECK-OUT"
          studentName={current.name}
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
            // A lesson still in the queue has no id yet, so the check-out
            // points at the check-in's own request id instead.
            if (current.lessonId) data.set("lessonId", current.lessonId);
            else data.set("checkInRequestId", current.requestId);
            const result = await checkOut(data);
            if (result.ok) toast.success("Đã check-out", { description: `Kết thúc buổi dạy ${current.name}.` });
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
              if (!current.lessonId) {
                await discard(current.queuedId ?? "");
                toast.success("Đã hủy buổi dạy");
                return;
              }
              const result = await deleteLesson({ id: current.lessonId });
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
