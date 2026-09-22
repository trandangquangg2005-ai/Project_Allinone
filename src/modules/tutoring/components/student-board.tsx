"use client";

import { CaretRightIcon, PlusIcon, StudentIcon } from "@phosphor-icons/react";
import { motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { initials } from "@/components/layout/user-menu";
import { formatVND } from "@/lib/money";
import { swatchStyle } from "@/lib/palette";
import { cn } from "@/lib/utils";
import type { StudentView } from "../types";
import { StudentSheet } from "./student-sheet";

export function BalanceLabel({ balance }: { balance: number }) {
  if (balance > 0) return <span className="text-debt">Còn thiếu {formatVND(balance)}</span>;
  if (balance < 0) return <span className="text-income">Trả trước {formatVND(-balance)}</span>;
  return <span className="text-muted-foreground">Đã đủ học phí</span>;
}

export function StudentBoard({ students }: { students: StudentView[] }) {
  const [sheet, setSheet] = useState({ open: false, key: 0 });
  const active = students.filter((s) => !s.archived);
  const archived = students.filter((s) => s.archived);

  const list = (items: StudentView[], muted = false) => (
    <ul className="grid gap-3 md:grid-cols-2">
      {items.map((student, i) => (
        <motion.li key={student.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
          <Link
            href={`/tutoring/students/${student.id}`}
            transitionTypes={["nav-forward"]}
            className={cn(
              "flex items-center gap-4 rounded-2xl border bg-card p-4 transition-[border-color,transform] hover:border-primary/30 active:scale-[0.99]",
              muted && "opacity-70",
            )}
          >
            <span className="hex flex size-12 shrink-0 items-center justify-center font-semibold" style={swatchStyle(student.color)}>
              {initials(student.name)}
            </span>
            <span className="grid min-w-0 flex-1 gap-0.5">
              <span className="truncate font-semibold">{student.name}</span>
              <span className="truncate text-[13px] text-muted-foreground">
                {[student.subject, student.grade].filter(Boolean).join(", ") || "Chưa ghi môn"}
                {`, ${formatVND(student.ratePerSession)}/buổi`}
              </span>
              <span data-money className="text-[13px] font-medium">
                <BalanceLabel balance={student.balance} />
              </span>
            </span>
            <span className="grid justify-items-end gap-0.5 text-right">
              <span className="tabular text-lg font-bold">{student.monthLessons}</span>
              <span className="text-[11px] text-muted-foreground">buổi tháng này</span>
            </span>
            <CaretRightIcon className="size-4 shrink-0 text-muted-foreground" />
          </Link>
        </motion.li>
      ))}
    </ul>
  );

  return (
    <div className="grid gap-5">
      <div className="flex justify-end">
        <Button onClick={() => setSheet((s) => ({ open: true, key: s.key + 1 }))}>
          <PlusIcon weight="bold" className="size-4" /> Thêm học sinh
        </Button>
      </div>
      {active.length ? (
        list(active)
      ) : (
        <EmptyState
          icon={<StudentIcon weight="duotone" />}
          title="Chưa có học sinh nào"
          description="Thêm học sinh cùng học phí mỗi buổi để bắt đầu chấm công."
        />
      )}
      {archived.length > 0 && (
        <details className="rounded-2xl border bg-card/60 px-4 py-3">
          <summary className="cursor-pointer list-none text-sm font-medium text-muted-foreground">Đã nghỉ học ({archived.length})</summary>
          <div className="mt-3">{list(archived, true)}</div>
        </details>
      )}
      <StudentSheet key={`student-${sheet.key}`} open={sheet.open} onOpenChange={(o) => setSheet((s) => ({ ...s, open: o }))} student={null} />
    </div>
  );
}
