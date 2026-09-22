"use client";

import { HandCoinsIcon, PlusIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AnimatedMoney } from "@/components/ui-kit/animated-number";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { SegmentedControl } from "@/components/ui-kit/segmented-control";
import { initials } from "@/components/layout/user-menu";
import { formatDate, todayVN } from "@/lib/datetime";
import { formatVND } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { DebtPaymentView, DebtView, WalletView } from "../types";
import { DebtDetail, DebtProgress } from "./debt-detail";
import { DebtSheet } from "./debt-sheet";

type Tab = "lent" | "borrowed" | "settled";

function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

function DueBadge({ debt, today }: { debt: DebtView; today: string }) {
  if (debt.settled || !debt.dueOn) return null;
  const days = daysBetween(today, debt.dueOn);
  const [label, tone] =
    days < 0
      ? [`Quá hạn ${-days} ngày`, "bg-expense-soft text-expense"]
      : days === 0
        ? ["Hạn hôm nay", "bg-debt-soft text-debt"]
        : days <= 3
          ? [`Còn ${days} ngày`, "bg-debt-soft text-debt"]
          : [`Hạn ${formatDate(debt.dueOn)}`, "bg-muted text-muted-foreground"];
  return <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap", tone)}>{label}</span>;
}

export function DebtBoard({
  debts,
  payments,
  wallets,
}: {
  debts: DebtView[];
  payments: Record<string, DebtPaymentView[]>;
  wallets: WalletView[];
}) {
  const [tab, setTab] = useState<Tab>("lent");
  const [sheet, setSheet] = useState<{ open: boolean; debt: DebtView | null; key: number }>({ open: false, debt: null, key: 0 });
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailKey, setDetailKey] = useState(0);
  const today = todayVN();

  const open = debts.filter((d) => !d.settled);
  const lentTotal = open.filter((d) => d.direction === "lent").reduce((s, d) => s + d.remaining, 0);
  const borrowedTotal = open.filter((d) => d.direction === "borrowed").reduce((s, d) => s + d.remaining, 0);
  const visible = tab === "settled" ? debts.filter((d) => d.settled) : open.filter((d) => d.direction === tab);
  const detail = debts.find((d) => d.id === detailId) ?? null;

  const openSheet = (debt: DebtView | null) => setSheet((s) => ({ open: true, debt, key: s.key + 1 }));

  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-2 divide-x rounded-2xl border bg-card">
        <button type="button" onClick={() => setTab("lent")} className="grid gap-1 px-4 py-4 text-left sm:px-5">
          <span className="text-[13px] text-muted-foreground">Người khác nợ bạn</span>
          <AnimatedMoney value={lentTotal} className="text-lg font-bold tracking-tight text-debt sm:text-2xl" />
        </button>
        <button type="button" onClick={() => setTab("borrowed")} className="grid gap-1 px-4 py-4 text-left sm:px-5">
          <span className="text-[13px] text-muted-foreground">Bạn đang nợ</span>
          <AnimatedMoney value={borrowedTotal} className="text-lg font-bold tracking-tight sm:text-2xl" />
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          value={tab}
          onChange={setTab}
          className="w-full sm:w-auto sm:min-w-[360px]"
          options={[
            { value: "lent", label: "Cần đòi" },
            { value: "borrowed", label: "Phải trả" },
            { value: "settled", label: "Đã xong" },
          ]}
        />
        <Button onClick={() => openSheet(null)} className="w-full sm:w-auto">
          <PlusIcon weight="bold" className="size-4" /> Thêm khoản nợ
        </Button>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<HandCoinsIcon weight="duotone" />}
          title={tab === "lent" ? "Không ai nợ bạn" : tab === "borrowed" ? "Bạn không nợ ai" : "Chưa có khoản nào xong"}
          description={tab === "settled" ? "Khoản nợ trả đủ sẽ chuyển vào đây." : "Ghi lại khoản cho vay hoặc đi vay để không quên."}
        />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          <AnimatePresence initial={false} mode="popLayout">
            {visible.map((debt) => (
              <motion.li
                key={debt.id}
                layout
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setDetailId(debt.id);
                    setDetailKey((k) => k + 1);
                  }}
                  className="grid w-full gap-3 rounded-2xl border bg-card p-4 text-left transition-[border-color,transform] hover:border-primary/30 active:scale-[0.99]"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "hex flex size-10 shrink-0 items-center justify-center text-[13px] font-semibold",
                        debt.direction === "lent" ? "bg-debt-soft text-debt" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {initials(debt.counterparty)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{debt.counterparty}</p>
                      <p data-money className="text-[13px] text-muted-foreground">
                        {debt.direction === "lent" ? "Cho vay" : "Vay"} {formatVND(debt.principal)} từ {formatDate(debt.occurredOn)}
                      </p>
                    </div>
                    <DueBadge debt={debt} today={today} />
                  </div>
                  <DebtProgress debt={debt} />
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-muted-foreground">{debt.settled ? "Đã trả đủ" : `Đã trả ${formatVND(debt.paid)}`}</span>
                    {!debt.settled && (
                      <span data-money className="font-semibold">
                        Còn {formatVND(debt.remaining)}
                      </span>
                    )}
                  </div>
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      <DebtSheet
        key={`sheet-${sheet.key}`}
        open={sheet.open}
        onOpenChange={(o) => setSheet((s) => ({ ...s, open: o }))}
        debt={sheet.debt}
        defaultDirection={tab === "borrowed" ? "borrowed" : "lent"}
        wallets={wallets}
      />
      {detail && (
        <DebtDetail
          key={`detail-${detailKey}`}
          open={detailId !== null}
          onOpenChange={(o) => !o && setDetailId(null)}
          debt={detail}
          payments={payments[detail.id] ?? []}
          wallets={wallets}
          onEdit={() => {
            setDetailId(null);
            openSheet(detail);
          }}
        />
      )}
    </div>
  );
}
