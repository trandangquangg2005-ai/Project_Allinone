"use client";

import { SpinnerIcon } from "@phosphor-icons/react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Field } from "@/components/form/field";
import { MoneyInput } from "@/components/form/money-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsiveDialog } from "@/components/ui-kit/responsive-dialog";
import { SegmentedControl } from "@/components/ui-kit/segmented-control";
import { todayVN } from "@/lib/datetime";
import { formatVND } from "@/lib/money";
import { WalletChips } from "@/modules/finance/components/transaction-sheet";
import type { WalletView } from "@/modules/finance/types";
import { recordPayment } from "../actions";
import type { StudentView } from "../types";

export function PaymentSheet({
  open,
  onOpenChange,
  student,
  wallets,
  bookToFinance,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: StudentView;
  /** Empty when the account has no Finance module. */
  wallets: WalletView[];
  bookToFinance: boolean;
}) {
  const [amount, setAmount] = useState<number | null>(student.balance > 0 ? student.balance : null);
  const [paidOn, setPaidOn] = useState(todayVN());
  const [method, setMethod] = useState<"transfer" | "cash">("transfer");
  const activeWallets = wallets.filter((w) => !w.archived);
  const bankWallet = activeWallets.find((w) => w.kind === "bank") ?? activeWallets[0];
  const cashWallet = activeWallets.find((w) => w.kind === "cash") ?? activeWallets[0];
  const [walletId, setWalletId] = useState<string | undefined>(bankWallet?.id);
  const [pending, startTransition] = useTransition();

  function changeMethod(next: "transfer" | "cash") {
    setMethod(next);
    const suggested = next === "cash" ? cashWallet : bankWallet;
    if (suggested) setWalletId(suggested.id);
  }

  function submit() {
    startTransition(async () => {
      const result = await recordPayment({
        studentId: student.id,
        amount: amount ?? 0,
        paidOn,
        method,
        walletId: bookToFinance ? walletId ?? null : null,
        note: "",
      });
      if (!result.ok) return void toast.error(result.error);
      toast.success("Đã ghi nhận học phí", {
        description: bookToFinance && walletId ? "Khoản thu đã được ghi vào Tài chính." : undefined,
      });
      onOpenChange(false);
    });
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Thu học phí: ${student.name}`}
      description={student.balance > 0 ? `Phụ huynh còn thiếu ${formatVND(student.balance)}.` : "Phụ huynh không còn thiếu học phí."}
      footer={
        <Button size="lg" className="w-full sm:w-auto sm:px-8" onClick={submit} disabled={pending || !amount}>
          {pending && <SpinnerIcon className="size-5 animate-spin" />}
          Ghi nhận {amount ? formatVND(amount) : ""}
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-5">
        <Field label="Số tiền phụ huynh trả">
          <MoneyInput value={amount} onChange={setAmount} size="lg" autoFocus />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Hình thức">
            <SegmentedControl
              value={method}
              onChange={changeMethod}
              options={[
                { value: "transfer", label: "Chuyển khoản" },
                { value: "cash", label: "Tiền mặt" },
              ]}
            />
          </Field>
          <Field label="Ngày nhận" htmlFor="pay-on">
            <Input id="pay-on" type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
          </Field>
        </div>
        {bookToFinance && activeWallets.length > 0 && (
          <Field label="Ghi vào ví" hint="Tạo khoản thu “Học phí gia sư” trong Tài chính.">
            <WalletChips wallets={activeWallets} value={walletId} onChange={setWalletId} />
          </Field>
        )}
      </div>
    </ResponsiveDialog>
  );
}
