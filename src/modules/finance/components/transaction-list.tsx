"use client";

import { AnimatePresence, motion } from "motion/react";
import { Amount } from "@/components/ui-kit/amount";
import { CategoryGlyph, DebtIcon, TransferIcon } from "@/components/ui-kit/category-icons";
import { HexBadge } from "@/components/ui-kit/hex-badge";
import { formatRelativeDay } from "@/lib/datetime";
import { formatVND } from "@/lib/money";
import type { TransactionView } from "../types";
import { useTransactionSheet } from "./transaction-provider";

function title(t: TransactionView) {
  if (t.kind === "transfer") return "Chuyển ví";
  // Debt movements carry a generated note such as "Cho An vay".
  if (t.source === "debt") return t.note || "Khoản nợ";
  return t.categoryName ?? "Không có danh mục";
}

function subtitle(t: TransactionView) {
  if (t.kind === "transfer") return [`${t.walletName} → ${t.toWalletName}`, t.note].filter(Boolean).join(", ");
  if (t.source === "debt") return t.walletName;
  return [t.note, t.walletName].filter(Boolean).join(", ");
}

function Glyph({ t }: { t: TransactionView }) {
  if (t.kind === "transfer") {
    return (
      <HexBadge color="slate">
        <TransferIcon weight="duotone" />
      </HexBadge>
    );
  }
  if (t.source === "debt") {
    return (
      <HexBadge color="amber">
        <DebtIcon weight="duotone" />
      </HexBadge>
    );
  }
  return (
    <HexBadge color={t.categoryColor ?? "slate"}>
      <CategoryGlyph icon={t.categoryIcon} />
    </HexBadge>
  );
}

export function TransactionRow({ t }: { t: TransactionView }) {
  const { openTransaction } = useTransactionSheet();
  return (
    <button
      type="button"
      onClick={() => openTransaction(t)}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted/70 active:bg-muted"
    >
      <Glyph t={t} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium">{title(t)}</span>
        <span className="block truncate text-[13px] text-muted-foreground">{subtitle(t)}</span>
      </span>
      <Amount value={t.amount} tone={t.kind === "transfer" ? "transfer" : t.kind} className="text-[15px]" />
    </button>
  );
}

/** Grouped by day with each day's net; rows animate in and out on changes. */
export function TransactionList({ transactions, today }: { transactions: TransactionView[]; today: string }) {
  const days = new Map<string, TransactionView[]>();
  for (const t of transactions) {
    const list = days.get(t.occurredOn) ?? [];
    list.push(t);
    days.set(t.occurredOn, list);
  }

  return (
    <div className="grid gap-4">
      <AnimatePresence initial={false}>
        {[...days.entries()].map(([day, items]) => {
          const net = items.reduce(
            (sum, t) => (t.kind === "income" ? sum + t.amount : t.kind === "expense" ? sum - t.amount : sum),
            0,
          );
          return (
            <motion.section
              key={day}
              layout="position"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="overflow-hidden rounded-2xl border bg-card"
            >
              <header className="flex items-center justify-between border-b px-4 py-2.5">
                <h3 className="text-sm font-semibold">{formatRelativeDay(day, today)}</h3>
                <span data-money className="text-[13px] text-muted-foreground">
                  {net === 0 ? "" : formatVND(net, { sign: true })}
                </span>
              </header>
              <ul className="p-1.5">
                <AnimatePresence initial={false}>
                  {items.map((t) => (
                    <motion.li
                      key={t.id}
                      layout
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <TransactionRow t={t} />
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </motion.section>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
