"use client";

import { PlusIcon } from "@phosphor-icons/react";
import { motion } from "motion/react";
import { createContext, use, useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CategoryView, WalletView } from "../types";
import { TransactionSheet, type TransactionDraft } from "./transaction-sheet";

type Ctx = { openTransaction: (draft?: TransactionDraft) => void; wallets: WalletView[]; categories: CategoryView[] };
const TransactionContext = createContext<Ctx | null>(null);

export function useTransactionSheet() {
  const ctx = use(TransactionContext);
  if (!ctx) throw new Error("useTransactionSheet must be used inside TransactionProvider");
  return ctx;
}

/** Holds the single add/edit sheet so any list row or button can open it. */
export function TransactionProvider({
  wallets,
  categories,
  children,
}: {
  wallets: WalletView[];
  categories: CategoryView[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<TransactionDraft>({});
  const [key, setKey] = useState(0);

  const openTransaction = useCallback((next: TransactionDraft = {}) => {
    setDraft(next);
    setKey((k) => k + 1); // fresh form state every time
    setOpen(true);
  }, []);

  const value = useMemo(() => ({ openTransaction, wallets, categories }), [openTransaction, wallets, categories]);

  return (
    <TransactionContext value={value}>
      {children}
      <TransactionSheet key={`sheet-${key}`} open={open} onOpenChange={setOpen} draft={draft} wallets={wallets} categories={categories} />
    </TransactionContext>
  );
}

export function AddTransactionButton({ className, label = "Thêm giao dịch" }: { className?: string; label?: string }) {
  const { openTransaction } = useTransactionSheet();
  return (
    <Button onClick={() => openTransaction()} className={className}>
      <PlusIcon weight="bold" className="size-4" />
      {label}
    </Button>
  );
}

/** Floating "+" for phones, sitting above the tab bar. */
export function AddTransactionFab() {
  const { openTransaction } = useTransactionSheet();
  return (
    <motion.button
      type="button"
      onClick={() => openTransaction()}
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileTap={{ scale: 0.92 }}
      className={cn(
        "hex fixed right-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-40 flex size-16 items-center justify-center bg-primary text-primary-foreground shadow-lg lg:hidden",
      )}
      aria-label="Thêm giao dịch"
    >
      <PlusIcon weight="bold" className="size-7" />
    </motion.button>
  );
}
