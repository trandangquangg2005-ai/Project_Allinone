"use client";

import {
  ArrowCounterClockwiseIcon,
  ChatCircleTextIcon,
  CheckCircleIcon,
  PencilSimpleIcon,
  PhoneIcon,
  SpinnerIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Field } from "@/components/form/field";
import { MoneyInput } from "@/components/form/money-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui-kit/confirm-dialog";
import { ResponsiveDialog } from "@/components/ui-kit/responsive-dialog";
import { formatDate, todayVN } from "@/lib/datetime";
import { formatVND } from "@/lib/money";
import { cn } from "@/lib/utils";
import { addDebtPayment, deleteDebt, deleteDebtPayment, setDebtSettled } from "../actions";
import type { DebtPaymentView, DebtView, WalletView } from "../types";
import { WalletChips } from "./transaction-sheet";

export function reminderText(debt: DebtView): string {
  const due = debt.dueOn ? `, hẹn trả ngày ${formatDate(debt.dueOn)}` : "";
  return `Chào ${debt.counterparty}, mình nhắn nhắc khoản ${formatVND(debt.remaining)} bạn mượn mình từ ngày ${formatDate(debt.occurredOn)}${due}. Khi nào tiện bạn chuyển giúp mình nhé. Cảm ơn bạn!`;
}

export function DebtProgress({ debt }: { debt: DebtView }) {
  const ratio = debt.principal > 0 ? Math.min(debt.paid / debt.principal, 1) : 0;
  return (
    <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(ratio * 100)} aria-valuemin={0} aria-valuemax={100}>
      <motion.div
        className={cn("h-full rounded-full", debt.settled ? "bg-income" : "bg-brand-blue")}
        initial={false}
        animate={{ width: `${ratio * 100}%` }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  );
}

export function DebtDetail({
  open,
  onOpenChange,
  debt,
  payments,
  wallets,
  onEdit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  debt: DebtView;
  payments: DebtPaymentView[];
  wallets: WalletView[];
  onEdit: () => void;
}) {
  const [amount, setAmount] = useState<number | null>(debt.remaining || null);
  const [paidOn, setPaidOn] = useState(todayVN());
  const [walletId, setWalletId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | "debt" | string>(null);
  const [pending, startTransition] = useTransition();
  const activeWallets = wallets.filter((w) => !w.archived);
  const lent = debt.direction === "lent";

  function run(action: () => Promise<{ ok: boolean; error?: string }>, success: string, close = false) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(success);
      setAmount(null);
      setWalletId(null);
      if (close) onOpenChange(false);
    });
  }

  async function remind() {
    const text = reminderText(debt);
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch {
        // cancelled: fall back to copying
      }
    }
    await navigator.clipboard.writeText(text);
    toast.success("Đã chép tin nhắn nhắc nợ", { description: "Dán vào Zalo hoặc Messenger để gửi." });
  }

  return (
    <>
      <ResponsiveDialog open={open} onOpenChange={onOpenChange} title={debt.counterparty} description={lent ? "Người này nợ bạn" : "Bạn nợ người này"}>
        <div className="grid grid-cols-1 gap-6">
          <section className="grid gap-3 rounded-2xl bg-muted/60 p-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[13px] text-muted-foreground">{debt.settled ? "Đã xong" : "Còn lại"}</p>
                <p data-money className={cn("text-[28px] leading-none font-bold tracking-tight", debt.settled ? "text-income" : "text-debt")}>
                  {formatVND(debt.remaining)}
                </p>
              </div>
              <p data-money className="text-right text-[13px] text-muted-foreground">
                đã trả {formatVND(debt.paid)}
                <br />
                trên {formatVND(debt.principal)}
              </p>
            </div>
            <DebtProgress debt={debt} />
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-muted-foreground">Ngày</dt>
                <dd className="font-medium">{formatDate(debt.occurredOn)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Hạn trả</dt>
                <dd className="font-medium">{debt.dueOn ? formatDate(debt.dueOn) : "Không đặt"}</dd>
              </div>
              {debt.note && (
                <div className="col-span-2">
                  <dt className="text-muted-foreground">Ghi chú</dt>
                  <dd>{debt.note}</dd>
                </div>
              )}
            </dl>
          </section>

          <div className="flex flex-wrap gap-2">
            {lent && !debt.settled && (
              <Button variant="outline" onClick={remind}>
                <ChatCircleTextIcon className="size-4" /> Nhắc nợ
              </Button>
            )}
            {debt.phone && (
              <Button variant="outline" asChild>
                <a href={`tel:${debt.phone}`}>
                  <PhoneIcon className="size-4" /> Gọi
                </a>
              </Button>
            )}
            <Button variant="outline" onClick={onEdit}>
              <PencilSimpleIcon className="size-4" /> Sửa
            </Button>
            {debt.settled ? (
              debt.remaining > 0 && (
                <Button variant="outline" disabled={pending} onClick={() => run(() => setDebtSettled({ id: debt.id, settled: false }), "Đã mở lại khoản nợ")}>
                  <ArrowCounterClockwiseIcon className="size-4" /> Mở lại
                </Button>
              )
            ) : (
              <Button variant="outline" disabled={pending} onClick={() => run(() => setDebtSettled({ id: debt.id, settled: true }), "Đã đánh dấu xong")}>
                <CheckCircleIcon className="size-4" /> Đánh dấu xong
              </Button>
            )}
            <Button variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setConfirm("debt")}>
              <TrashIcon className="size-4" /> Xóa
            </Button>
          </div>

          {!debt.settled && (
            <section className="grid gap-4 rounded-2xl border p-4">
              <h3 className="font-semibold">{lent ? "Ghi nhận tiền được trả" : "Ghi nhận lần trả nợ"}</h3>
              <Field label="Số tiền">
                <MoneyInput value={amount} onChange={setAmount} />
              </Field>
              <Field label="Ngày trả" htmlFor="pay-date">
                <Input id="pay-date" type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
              </Field>
              <Field label={lent ? "Tiền vào ví" : "Trả từ ví"} hint="Bỏ trống nếu không muốn đổi số dư ví.">
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
              <Button
                disabled={pending || !amount}
                onClick={() =>
                  run(
                    () => addDebtPayment({ debtId: debt.id, amount: amount ?? 0, paidOn, walletId, note: "" }),
                    "Đã ghi nhận",
                  )
                }
              >
                {pending && <SpinnerIcon className="size-4 animate-spin" />}
                Ghi nhận {amount ? formatVND(amount) : ""}
              </Button>
            </section>
          )}

          <section className="grid gap-2">
            <h3 className="text-sm font-semibold text-muted-foreground">Lịch sử trả ({payments.length})</h3>
            {payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có lần trả nào.</p>
            ) : (
              <ul className="divide-y rounded-2xl border">
                <AnimatePresence initial={false}>
                  {payments.map((p) => (
                    <motion.li
                      key={p.id}
                      layout
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-center gap-3 px-4 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p data-money className="font-semibold">{formatVND(p.amount)}</p>
                        <p className="text-[13px] text-muted-foreground">
                          {formatDate(p.paidOn)}
                          {p.walletName ? `, ${p.walletName}` : ""}
                        </p>
                      </div>
                      <Button variant="ghost" size="icon-sm" aria-label="Xóa lần trả" onClick={() => setConfirm(p.id)}>
                        <TrashIcon className="size-4" />
                      </Button>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </section>
        </div>
      </ResponsiveDialog>

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm === "debt" ? "Xóa khoản nợ này?" : "Xóa lần trả này?"}
        description={
          confirm === "debt"
            ? "Lịch sử trả và các giao dịch ví gắn với khoản nợ cũng bị xóa."
            : "Giao dịch ví gắn với lần trả này (nếu có) cũng bị xóa."
        }
        confirmLabel="Xóa"
        onConfirm={() => {
          if (confirm === "debt") run(() => deleteDebt({ id: debt.id }), "Đã xóa khoản nợ", true);
          else if (confirm) run(() => deleteDebtPayment({ id: confirm }), "Đã xóa lần trả");
        }}
      />
    </>
  );
}
