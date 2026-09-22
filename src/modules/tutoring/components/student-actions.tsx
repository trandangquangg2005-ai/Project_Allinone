"use client";

import { CalendarPlusIcon, HandCoinsIcon, PencilSimpleIcon, TrashIcon } from "@phosphor-icons/react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui-kit/confirm-dialog";
import { formatDate } from "@/lib/datetime";
import { formatVND } from "@/lib/money";
import type { WalletView } from "@/modules/finance/types";
import { deletePayment } from "../actions";
import type { StudentView, TuitionPaymentView } from "../types";
import { LessonSheet } from "./lesson-sheet";
import { PaymentSheet } from "./payment-sheet";
import { StudentSheet } from "./student-sheet";

export function StudentActions({
  student,
  wallets,
  bookToFinance,
}: {
  student: StudentView;
  wallets: WalletView[];
  bookToFinance: boolean;
}) {
  const [open, setOpen] = useState<null | "edit" | "pay" | "manual">(null);
  const [key, setKey] = useState(0);
  const show = (which: "edit" | "pay" | "manual") => {
    setKey((k) => k + 1);
    setOpen(which);
  };
  const close = (o: boolean) => !o && setOpen(null);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => show("pay")}>
          <HandCoinsIcon className="size-4" /> Thu học phí
        </Button>
        <Button variant="outline" onClick={() => show("manual")}>
          <CalendarPlusIcon className="size-4" /> Thêm buổi thủ công
        </Button>
        <Button variant="outline" onClick={() => show("edit")}>
          <PencilSimpleIcon className="size-4" /> Sửa thông tin
        </Button>
      </div>
      {open === "edit" && <StudentSheet key={`edit-${key}`} open onOpenChange={close} student={student} />}
      {open === "pay" && (
        <PaymentSheet key={`pay-${key}`} open onOpenChange={close} student={student} wallets={wallets} bookToFinance={bookToFinance} />
      )}
      {open === "manual" && (
        <LessonSheet
          key={`manual-${key}`}
          open
          onOpenChange={close}
          manualFor={{ studentId: student.id, studentName: student.name, fee: student.ratePerSession }}
        />
      )}
    </>
  );
}

export function PaymentList({ payments }: { payments: TuitionPaymentView[] }) {
  const [confirm, setConfirm] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  if (!payments.length) return <p className="text-sm text-muted-foreground">Chưa ghi nhận khoản học phí nào.</p>;
  return (
    <>
      <ul className="divide-y rounded-2xl border bg-card">
        {payments.map((p) => (
          <li key={p.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p data-money className="font-semibold text-income">
                +{formatVND(p.amount)}
              </p>
              <p className="text-[13px] text-muted-foreground">
                {formatDate(p.paidOn)}, {p.method === "cash" ? "tiền mặt" : "chuyển khoản"}
                {p.walletName ? `, vào ${p.walletName}` : ""}
              </p>
            </div>
            <Button variant="ghost" size="icon-sm" aria-label="Xóa khoản thu" disabled={pending} onClick={() => setConfirm(p.id)}>
              <TrashIcon className="size-4" />
            </Button>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Xóa khoản học phí này?"
        description="Khoản thu tương ứng trong Tài chính (nếu có) cũng bị xóa."
        confirmLabel="Xóa"
        onConfirm={() =>
          confirm &&
          startTransition(async () => {
            const result = await deletePayment({ id: confirm });
            if (!result.ok) toast.error(result.error);
            else toast.success("Đã xóa khoản học phí");
          })
        }
      />
    </>
  );
}
