"use client";

import { NotePencilIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { formatDuration, formatRelativeDay, formatTime, toVNDate, todayVN } from "@/lib/datetime";
import { formatVND } from "@/lib/money";
import { initials } from "@/components/layout/user-menu";
import { swatchStyle } from "@/lib/palette";
import { cn } from "@/lib/utils";
import { lessonDuration, STATUS_LABELS, type LessonView } from "../types";
import { LessonSheet } from "./lesson-sheet";
import { PhotoThumb } from "./photo-lightbox";

export function LessonBadges({ lesson }: { lesson: Pick<LessonView, "status" | "isManual" | "edited"> }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {lesson.status !== "completed" && (
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-semibold",
            lesson.status === "in_progress" ? "bg-accent text-primary" : "bg-muted text-muted-foreground",
          )}
        >
          {STATUS_LABELS[lesson.status]}
        </span>
      )}
      {lesson.isManual && <span className="rounded-full bg-debt-soft px-2 py-0.5 text-[11px] font-semibold text-debt">Nhập tay</span>}
      {lesson.edited && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">Đã chỉnh sửa</span>}
    </span>
  );
}

/** Lessons grouped by day. Tapping a finished lesson opens it for editing. */
export function LessonList({ lessons, showStudent = true }: { lessons: LessonView[]; showStudent?: boolean }) {
  const [editing, setEditing] = useState<LessonView | null>(null);
  const [key, setKey] = useState(0);
  const today = todayVN();

  const days = new Map<string, LessonView[]>();
  for (const lesson of lessons) {
    const day = toVNDate(lesson.checkInAt);
    days.set(day, [...(days.get(day) ?? []), lesson]);
  }

  return (
    <div className="grid gap-4">
      <AnimatePresence initial={false}>
        {[...days.entries()].map(([day, items]) => (
          <motion.section
            key={day}
            layout="position"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="overflow-hidden rounded-2xl border bg-card"
          >
            <h3 className="border-b px-4 py-2.5 text-sm font-semibold">{formatRelativeDay(day, today)}</h3>
            <ul className="divide-y">
              {items.map((lesson) => {
                const time = (
                  <span className="tabular text-sm text-muted-foreground">
                    {formatTime(lesson.checkInAt)}
                    {lesson.checkOutAt ? `–${formatTime(lesson.checkOutAt)}` : ""}
                    {lesson.checkOutAt ? `, ${formatDuration(lessonDuration(lesson))}` : ""}
                  </span>
                );
                const hasPhotos = lesson.checkInPhotoId || lesson.checkOutPhotoId;
                return (
                  <li key={lesson.id} className="grid gap-2.5 px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-start sm:gap-4">
                    <button
                      type="button"
                      disabled={lesson.status === "in_progress"}
                      onClick={() => {
                        setEditing(lesson);
                        setKey((k) => k + 1);
                      }}
                      className="flex min-w-0 gap-3 text-left disabled:cursor-default"
                    >
                      {showStudent && (
                        <span className="hex mt-0.5 flex size-9 shrink-0 items-center justify-center text-xs font-semibold" style={swatchStyle(lesson.studentColor)}>
                          {initials(lesson.studentName)}
                        </span>
                      )}
                      <span className="grid min-w-0 flex-1 gap-1">
                        <span className="flex items-start justify-between gap-3">
                          <span className="min-w-0 truncate font-semibold">{showStudent ? lesson.studentName : time}</span>
                          <span
                            data-money
                            className={cn("shrink-0 text-sm font-semibold", lesson.status === "cancelled" && "text-muted-foreground line-through")}
                          >
                            {formatVND(lesson.fee)}
                          </span>
                        </span>
                        {(showStudent || lesson.status !== "completed" || lesson.isManual || lesson.edited) && (
                          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            {showStudent && time}
                            <LessonBadges lesson={lesson} />
                          </span>
                        )}
                        {lesson.lessonNote && <span className="line-clamp-2 text-[13px] text-muted-foreground">{lesson.lessonNote}</span>}
                        {lesson.privateNote && (
                          <span className="flex items-center gap-1 text-[12px] text-muted-foreground/80">
                            <NotePencilIcon className="size-3.5 shrink-0" /> {lesson.privateNote}
                          </span>
                        )}
                      </span>
                    </button>
                    {hasPhotos && (
                      <span className={cn("flex gap-2", showStudent && "pl-12 sm:pl-0")}>
                        {lesson.checkInPhotoId && (
                          <PhotoThumb
                            id={lesson.checkInPhotoId}
                            src={`/api/photos/${lesson.checkInPhotoId}`}
                            caption={`Check-in ${formatTime(lesson.checkInAt)}, ${lesson.studentName}`}
                            label="Vào"
                            className="size-14"
                          />
                        )}
                        {lesson.checkOutPhotoId && lesson.checkOutAt && (
                          <PhotoThumb
                            id={lesson.checkOutPhotoId}
                            src={`/api/photos/${lesson.checkOutPhotoId}`}
                            caption={`Check-out ${formatTime(lesson.checkOutAt)}, ${lesson.studentName}`}
                            label="Ra"
                            className="size-14"
                          />
                        )}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </motion.section>
        ))}
      </AnimatePresence>
      {editing && <LessonSheet key={`lesson-${key}`} open={!!editing} onOpenChange={(o) => !o && setEditing(null)} lesson={editing} />}
    </div>
  );
}
