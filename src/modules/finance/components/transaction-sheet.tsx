"use client";

import { LockSimpleIcon, SpinnerIcon, TrashIcon } from "@phosphor-icons/react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Field } from "@/components/form/field";
import { MoneyInput } from "@/components/form/money-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CategoryGlyph, WALLET_ICONS } from "@/components/ui-kit/category-icons";
import { ConfirmDialog } from "@/components/ui-kit/confirm-dialog";
import { HexBadge } from "@/components/ui-kit/hex-badge";
import { ResponsiveDialog } from "@/components/ui-kit/responsive-dialog";
import { SegmentedControl } from "@/components/ui-kit/segmented-control";
import { addDays, todayVN } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import { deleteTransaction, saveTransaction } from "../actions";
import type { CategoryView, TransactionView, TxKind, WalletView } from "../types";

export type TransactionDraft = Partial<TransactionView> & { kind?: TxKind };

const LAST_WALLET_KEY = "aio:last-wallet";

function rememberedWallet(wallets: WalletView[]): string | undefined {
  try {
    const id = localStorage.getItem(LAST_WALLET_KEY);
    if (id && wallets.some((w) => w.id === id)) return id;
  } catch {
    // storage blocked (private mode)
  }
  return wallets[0]?.id;
}

const SOURCE_NOTE: Record<string, string> = {
  tutoring: "Giao dịch này được tạo khi thu học phí, hãy sửa ở mục Gia sư.",
  debt: "Giao dịch này gắn với một khoản nợ, hãy sửa ở mục Nợ.",
};

export function TransactionSheet({
  open,
  onOpenChange,
  draft,
  wallets,
  categories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: TransactionDraft;
  wallets: WalletView[];
  categories: CategoryView[];
}) {
  const editing = !!draft.id;
  const locked = editing && draft.source !== undefined && draft.source !== "manual";
  const [kind, setKind] = useState<TxKind>(draft.kind ?? "expense");
  const [amount, setAmount] = useState<number | null>(draft.amount ?? null);
  const [categoryId, setCategoryId] = useState<string | null>(draft.categoryId ?? null);
  const [walletId, setWalletId] = useState<string | undefined>(() => draft.walletId ?? rememberedWallet(wallets));
  const [toWalletId, setToWalletId] = useState<string | null>(draft.toWalletId ?? null);
  const [occurredOn, setOccurredOn] = useState(draft.occurredOn ?? todayVN());
  const [note, setNote] = useState(draft.note ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  const today = todayVN();
  const visibleCategories = categories.filter((c) => c.kind === kind && (!c.archived || c.id === categoryId));
  const activeWallets = wallets.filter((w) => !w.archived || w.id === walletId || w.id === toWalletId);

  function changeKind(next: TxKind) {
    setKind(next);
    setErrors({});
    if (next !== "transfer" && !categories.some((c) => c.id === categoryId && c.kind === next)) setCategoryId(null);
  }

  function submit() {
    if (!walletId) {
      setErrors({ walletId: "Chọn ví." });
      return;
    }
    startTransition(async () => {
      const result = await saveTransaction({
        id: draft.id,
        kind,
        amount: amount ?? 0,
        walletId,
        toWalletId: kind === "transfer" ? toWalletId : null,
        categoryId: kind === "transfer" ? null : categoryId,
        occurredOn,
        note,
      });
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors || !Object.keys(result.fieldErrors).length) toast.error(result.error);
        return;
      }
      try {
        localStorage.setItem(LAST_WALLET_KEY, walletId);
      } catch {}
      toast.success(editing ? "Đã lưu thay đổi" : "Đã thêm giao dịch");
      onOpenChange(false);
    });
  }

  function remove() {
    if (!draft.id) return;
    startTransition(async () => {
      const result = await deleteTransaction({ id: draft.id! });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Đã xóa giao dịch");
      onOpenChange(false);
    });
  }

  const footer = locked ? (
    <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
      Đóng
    </Button>
  ) : (
    <div className="flex w-full items-center gap-2 sm:justify-end">
      {editing && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setConfirmDelete(true)}
          disabled={pending}
          aria-label="Xóa giao dịch"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <TrashIcon className="size-5" />
        </Button>
      )}
      <Button onClick={submit} disabled={pending} size="lg" className="flex-1 sm:flex-none sm:px-8">
        {pending && <SpinnerIcon className="size-5 animate-spin" />}
        {editing ? "Lưu thay đổi" : "Lưu giao dịch"}
      </Button>
    </div>
  );

  return (
    <>
      <ResponsiveDialog
        open={open}
        onOpenChange={onOpenChange}
        title={editing ? "Sửa giao dịch" : "Thêm giao dịch"}
        footer={footer}
      >
        <fieldset disabled={locked || pending} className="grid min-w-0 grid-cols-1 gap-5">
          {locked && (
            <p className="flex items-start gap-2 rounded-xl bg-muted px-3.5 py-3 text-sm text-muted-foreground">
              <LockSimpleIcon className="mt-0.5 size-4 shrink-0" />
              {SOURCE_NOTE[draft.source!]}
            </p>
          )}

          <SegmentedControl
            value={kind}
            onChange={changeKind}
            options={[
              { value: "expense", label: "Khoản chi" },
              { value: "income", label: "Khoản thu" },
              { value: "transfer", label: "Chuyển ví" },
            ]}
          />

          <Field label="Số tiền" htmlFor="tx-amount" error={errors.amount}>
            <MoneyInput id="tx-amount" size="lg" value={amount} onChange={setAmount} autoFocus={!editing} invalid={!!errors.amount} />
          </Field>

          {kind !== "transfer" ? (
            <Field label="Danh mục" error={errors.categoryId}>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                {visibleCategories.map((category) => {
                  const selected = category.id === categoryId;
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setCategoryId(category.id)}
                      aria-pressed={selected}
                      className={cn(
                        "grid justify-items-center gap-1.5 rounded-xl border px-1 py-2.5 text-center text-xs leading-tight transition-[border-color,background-color,transform] active:scale-[0.97]",
                        selected ? "border-primary bg-accent font-semibold" : "border-transparent hover:bg-muted",
                      )}
                    >
                      <HexBadge color={category.color} size="sm">
                        <CategoryGlyph icon={category.icon} />
                      </HexBadge>
                      <span className="line-clamp-2">{category.name}</span>
                    </button>
                  );
                })}
              </div>
            </Field>
          ) : null}

          <Field label={kind === "transfer" ? "Từ ví" : "Ví"} error={errors.walletId}>
            <WalletChips wallets={activeWallets} value={walletId} onChange={setWalletId} />
          </Field>

          {kind === "transfer" && (
            <Field label="Sang ví" error={errors.toWalletId}>
              <WalletChips
                wallets={activeWallets.filter((w) => w.id !== walletId)}
                value={toWalletId ?? undefined}
                onChange={setToWalletId}
              />
            </Field>
          )}

          <Field label="Ngày" htmlFor="tx-date" error={errors.occurredOn}>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                id="tx-date"
                type="date"
                value={occurredOn}
                max={addDays(today, 365)}
                onChange={(e) => setOccurredOn(e.target.value)}
                className="w-auto min-w-40 flex-1"
              />
              {[
                { label: "Hôm nay", value: today },
                { label: "Hôm qua", value: addDays(today, -1) },
              ].map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => setOccurredOn(chip.value)}
                  className={cn(
                    "h-11 rounded-xl border px-3 text-sm font-medium transition-colors",
                    occurredOn === chip.value ? "border-primary bg-accent" : "bg-card hover:bg-muted",
                  )}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Ghi chú" htmlFor="tx-note" error={errors.note}>
            <Textarea
              id="tx-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={kind === "expense" ? "Ví dụ: cơm trưa với bạn" : kind === "income" ? "Ví dụ: lương tháng 9" : "Ví dụ: rút tiền ATM"}
              rows={2}
              maxLength={500}
            />
          </Field>
        </fieldset>
      </ResponsiveDialog>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Xóa giao dịch này?"
        description="Số dư của ví sẽ được tính lại. Không hoàn tác được."
        confirmLabel="Xóa"
        onConfirm={remove}
      />
    </>
  );
}

export function WalletChips({
  wallets,
  value,
  onChange,
}: {
  wallets: WalletView[];
  value: string | undefined;
  onChange: (id: string) => void;
}) {
  if (!wallets.length) {
    return <p className="text-sm text-muted-foreground">Chưa có ví nào khác. Tạo thêm ví ở mục Ví.</p>;
  }
  return (
    <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {wallets.map((wallet) => {
        const Icon = WALLET_ICONS[wallet.kind];
        const selected = wallet.id === value;
        return (
          <button
            key={wallet.id}
            type="button"
            onClick={() => onChange(wallet.id)}
            aria-pressed={selected}
            className={cn(
              "flex h-11 shrink-0 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-[border-color,background-color,transform] active:scale-[0.97]",
              selected ? "border-primary bg-accent" : "bg-card hover:bg-muted",
            )}
          >
            <HexBadge color={wallet.color} size="sm" className="size-7 [&_svg]:size-3.5">
              <Icon weight="duotone" />
            </HexBadge>
            {wallet.name}
          </button>
        );
      })}
    </div>
  );
}
