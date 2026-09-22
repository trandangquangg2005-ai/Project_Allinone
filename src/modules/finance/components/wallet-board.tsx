"use client";

import { ArchiveIcon, ArrowCounterClockwiseIcon, ArrowsLeftRightIcon, PlusIcon, SpinnerIcon, TrashIcon } from "@phosphor-icons/react";
import { motion } from "motion/react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Field } from "@/components/form/field";
import { MoneyInput } from "@/components/form/money-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AnimatedMoney } from "@/components/ui-kit/animated-number";
import { WALLET_ICONS } from "@/components/ui-kit/category-icons";
import { ConfirmDialog } from "@/components/ui-kit/confirm-dialog";
import { HexBadge } from "@/components/ui-kit/hex-badge";
import { ResponsiveDialog } from "@/components/ui-kit/responsive-dialog";
import { SegmentedControl } from "@/components/ui-kit/segmented-control";
import { SwatchPicker } from "@/components/ui-kit/swatch-picker";
import { formatVND } from "@/lib/money";
import { cn } from "@/lib/utils";
import { archiveWallet, deleteWallet, saveWallet } from "../actions";
import { WALLET_KIND_LABELS, type WalletKind, type WalletView } from "../types";
import { useTransactionSheet } from "./transaction-provider";

export function WalletBoard({ wallets }: { wallets: WalletView[] }) {
  const { openTransaction } = useTransactionSheet();
  const [editing, setEditing] = useState<WalletView | null>(null);
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(0);
  const active = wallets.filter((w) => !w.archived);
  const archived = wallets.filter((w) => w.archived);
  const total = active.reduce((sum, w) => sum + w.balance, 0);

  function edit(wallet: WalletView | null) {
    setEditing(wallet);
    setKey((k) => k + 1);
    setOpen(true);
  }

  return (
    <div className="grid gap-6">
      <section className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border bg-card p-5 sm:p-6">
        <div className="grid gap-1">
          <span className="text-sm text-muted-foreground">Tổng số dư {active.length} ví</span>
          <AnimatedMoney value={total} className={cn("text-[34px] leading-none font-bold tracking-tight", total < 0 && "text-expense")} />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => openTransaction({ kind: "transfer" })} disabled={active.length < 2}>
            <ArrowsLeftRightIcon className="size-4" /> Chuyển tiền
          </Button>
          <Button onClick={() => edit(null)}>
            <PlusIcon weight="bold" className="size-4" /> Thêm ví
          </Button>
        </div>
      </section>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {active.map((wallet, i) => (
          <motion.li
            key={wallet.id}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
          >
            <WalletCard wallet={wallet} onClick={() => edit(wallet)} />
          </motion.li>
        ))}
      </ul>

      {archived.length > 0 && (
        <details className="group rounded-2xl border bg-card/60 px-4 py-3">
          <summary className="cursor-pointer list-none text-sm font-medium text-muted-foreground">
            Ví đã ẩn ({archived.length})
          </summary>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {archived.map((wallet) => (
              <li key={wallet.id}>
                <WalletCard wallet={wallet} onClick={() => edit(wallet)} muted />
              </li>
            ))}
          </ul>
        </details>
      )}

      <WalletSheet key={`sheet-${key}`} open={open} onOpenChange={setOpen} wallet={editing} />
    </div>
  );
}

function WalletCard({ wallet, onClick, muted }: { wallet: WalletView; onClick: () => void; muted?: boolean }) {
  const Icon = WALLET_ICONS[wallet.kind];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "grid w-full gap-4 rounded-2xl border bg-card p-4 text-left transition-[border-color,transform] hover:border-primary/30 active:scale-[0.99]",
        muted && "opacity-70",
      )}
    >
      <span className="flex items-center gap-3">
        <HexBadge color={wallet.color}>
          <Icon weight="duotone" />
        </HexBadge>
        <span className="min-w-0">
          <span className="block truncate font-semibold">{wallet.name}</span>
          <span className="block text-[13px] text-muted-foreground">{WALLET_KIND_LABELS[wallet.kind]}</span>
        </span>
      </span>
      <span data-money className={cn("text-xl font-bold tracking-tight", wallet.balance < 0 && "text-expense")}>
        {formatVND(wallet.balance)}
      </span>
    </button>
  );
}

function WalletSheet({
  open,
  onOpenChange,
  wallet,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wallet: WalletView | null;
}) {
  const [name, setName] = useState(wallet?.name ?? "");
  const [kind, setKind] = useState<WalletKind>(wallet?.kind ?? "cash");
  const [color, setColor] = useState(wallet?.color ?? "blue");
  const [opening, setOpening] = useState<number | null>(wallet?.openingBalance ?? 0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ ok: boolean; error?: string; fieldErrors?: Record<string, string> }>, success: string) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success(success);
      onOpenChange(false);
    });
  }

  const save = () =>
    run(
      () => saveWallet({ id: wallet?.id, name, kind, color: color as "blue", openingBalance: opening ?? 0 }),
      wallet ? "Đã lưu ví" : "Đã tạo ví",
    );

  return (
    <>
      <ResponsiveDialog
        open={open}
        onOpenChange={onOpenChange}
        title={wallet ? "Sửa ví" : "Thêm ví"}
        description={wallet ? `Số dư hiện tại ${formatVND(wallet.balance)}` : "Tiền mặt, tài khoản ngân hàng, MoMo, ZaloPay…"}
        footer={
          <div className="flex w-full items-center gap-2 sm:justify-end">
            {wallet && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={pending}
                  onClick={() =>
                    run(
                      () => archiveWallet({ id: wallet.id, archived: !wallet.archived }),
                      wallet.archived ? "Đã hiện lại ví" : "Đã ẩn ví",
                    )
                  }
                  aria-label={wallet.archived ? "Hiện lại ví" : "Ẩn ví"}
                  title={wallet.archived ? "Hiện lại ví" : "Ẩn ví (giữ lịch sử)"}
                >
                  {wallet.archived ? <ArrowCounterClockwiseIcon className="size-5" /> : <ArchiveIcon className="size-5" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={pending}
                  onClick={() => setConfirmDelete(true)}
                  aria-label="Xóa ví"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <TrashIcon className="size-5" />
                </Button>
              </>
            )}
            <Button onClick={save} disabled={pending} size="lg" className="flex-1 sm:flex-none sm:px-8">
              {pending && <SpinnerIcon className="size-5 animate-spin" />}
              {wallet ? "Lưu" : "Tạo ví"}
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-5">
          <Field label="Tên ví" htmlFor="wallet-name" error={errors.name}>
            <Input id="wallet-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ví dụ: MoMo" maxLength={60} autoFocus={!wallet} />
          </Field>
          <Field label="Loại ví">
            <SegmentedControl
              value={kind}
              onChange={setKind}
              options={(Object.keys(WALLET_KIND_LABELS) as WalletKind[]).map((k) => ({ value: k, label: WALLET_KIND_LABELS[k] }))}
            />
          </Field>
          <Field label="Màu">
            <SwatchPicker value={color} onChange={setColor} />
          </Field>
          <Field
            label="Số dư ban đầu"
            error={errors.openingBalance}
            hint="Số tiền đang có trong ví lúc bắt đầu dùng AIO. Có thể âm (ví dụ thẻ tín dụng)."
          >
            <MoneyInput value={opening} onChange={setOpening} allowNegative />
          </Field>
        </div>
      </ResponsiveDialog>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Xóa ví này?"
        description="Chỉ xóa được ví chưa có giao dịch nào. Ví đã dùng thì hãy ẩn để giữ lịch sử."
        confirmLabel="Xóa ví"
        onConfirm={() => wallet && run(() => deleteWallet({ id: wallet.id }), "Đã xóa ví")}
      />
    </>
  );
}
