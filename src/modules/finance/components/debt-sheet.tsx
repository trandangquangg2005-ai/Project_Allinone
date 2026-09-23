"use client";

import { SpinnerIcon } from "@phosphor-icons/react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Field } from "@/components/form/field";
import { MoneyInput } from "@/components/form/money-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ResponsiveDialog } from "@/components/ui-kit/responsive-dialog";
import { SegmentedControl } from "@/components/ui-kit/segmented-control";
import { todayVN } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import { saveDebt } from "../offline-actions";
import type { DebtView, WalletView } from "../types";
import { WalletChips } from "./transaction-sheet";

export function DebtSheet({
  open,
  onOpenChange,
  debt,
  defaultDirection = "lent",
  wallets,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  debt: DebtView | null;
  defaultDirection?: "lent" | "borrowed";
  wallets: WalletView[];
}) {
  const [direction, setDirection] = useState<"lent" | "borrowed">(debt?.direction ?? defaultDirection);
  const [counterparty, setCounterparty] = useState(debt?.counterparty ?? "");
  const [phone, setPhone] = useState(debt?.phone ?? "");
  const [principal, setPrincipal] = useState<number | null>(debt?.principal ?? null);
  const [occurredOn, setOccurredOn] = useState(debt?.occurredOn ?? todayVN());
  const [dueOn, setDueOn] = useState(debt?.dueOn ?? "");
  const [note, setNote] = useState(debt?.note ?? "");
  const [walletId, setWalletId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const activeWallets = wallets.filter((w) => !w.archived);

  function submit() {
    startTransition(async () => {
      const result = await saveDebt({
        id: debt?.id,
        direction,
        counterparty,
        phone,
        principal: principal ?? 0,
        occurredOn,
        dueOn: dueOn || null,
        note,
        walletId: debt ? null : walletId,
      });
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors || !Object.keys(result.fieldErrors).length) toast.error(result.error);
        return;
      }
      toast.success(debt ? "Đã lưu khoản nợ" : "Đã thêm khoản nợ");
      onOpenChange(false);
    });
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={debt ? "Sửa khoản nợ" : "Thêm khoản nợ"}
      footer={
        <Button onClick={submit} disabled={pending} size="lg" className="w-full sm:w-auto sm:px-8">
          {pending && <SpinnerIcon className="size-5 animate-spin" />}
          {debt ? "Lưu" : "Thêm khoản nợ"}
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-5">
        {!debt && (
          <SegmentedControl
            value={direction}
            onChange={setDirection}
            options={[
              { value: "lent", label: "Mình cho vay" },
              { value: "borrowed", label: "Mình đi vay" },
            ]}
          />
        )}
        <Field label={direction === "lent" ? "Người vay" : "Người cho vay"} htmlFor="debt-name" error={errors.counterparty}>
          <Input id="debt-name" value={counterparty} onChange={(e) => setCounterparty(e.target.value)} maxLength={60} autoFocus={!debt} placeholder="Tên người" />
        </Field>
        <Field label="Số tiền" error={errors.principal}>
          <MoneyInput value={principal} onChange={setPrincipal} size="lg" invalid={!!errors.principal} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ngày" htmlFor="debt-date" error={errors.occurredOn}>
            <Input id="debt-date" type="date" value={occurredOn} onChange={(e) => setOccurredOn(e.target.value)} />
          </Field>
          <Field label="Hạn trả (nếu có)" htmlFor="debt-due" error={errors.dueOn}>
            <Input id="debt-due" type="date" value={dueOn} min={occurredOn} onChange={(e) => setDueOn(e.target.value)} />
          </Field>
        </div>
        <Field label="Số điện thoại (nếu có)" htmlFor="debt-phone" error={errors.phone}>
          <Input id="debt-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} />
        </Field>
        {!debt && (
          <Field
            label={direction === "lent" ? "Trừ tiền từ ví" : "Cộng tiền vào ví"}
            hint="Chọn ví nếu tiền thật sự đi qua ví đó, để số dư luôn khớp. Khoản này không tính vào thu chi."
          >
            <div className="grid gap-2">
              <button
                type="button"
                onClick={() => setWalletId(null)}
                aria-pressed={walletId === null}
                className={cn(
                  "h-11 w-fit rounded-xl border px-3 text-sm font-medium transition-colors",
                  walletId === null ? "border-primary bg-accent" : "bg-card hover:bg-muted",
                )}
              >
                Không ghi vào ví
              </button>
              <WalletChips wallets={activeWallets} value={walletId ?? undefined} onChange={setWalletId} />
            </div>
          </Field>
        )}
        <Field label="Ghi chú" htmlFor="debt-note" error={errors.note}>
          <Textarea id="debt-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} placeholder="Ví dụ: mượn đóng tiền nhà" />
        </Field>
      </div>
    </ResponsiveDialog>
  );
}
