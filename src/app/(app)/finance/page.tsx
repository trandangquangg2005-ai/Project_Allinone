import { ReceiptIcon } from "@phosphor-icons/react/ssr";
import type { Metadata } from "next";
import { Page } from "@/components/layout/page";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { MonthSwitcher } from "@/components/ui-kit/month-switcher";
import { withTenant } from "@/db";
import { requireModule } from "@/lib/auth/dal";
import { currentMonthVN, formatMonthLabel, isValidMonth, todayVN } from "@/lib/datetime";
import { MonthSummary } from "@/modules/finance/components/month-summary";
import { TransactionFilters } from "@/modules/finance/components/transaction-filters";
import { TransactionList } from "@/modules/finance/components/transaction-list";
import { AddTransactionButton, AddTransactionFab } from "@/modules/finance/components/transaction-provider";
import { listTransactions, listWallets, monthSummary } from "@/modules/finance/queries";
import type { TxKind } from "@/modules/finance/types";

export const metadata: Metadata = { title: "Thu chi" };

const UUID = /^[0-9a-f-]{36}$/i;
const KINDS: TxKind[] = ["income", "expense", "transfer"];

export default async function TransactionsPage({ searchParams }: PageProps<"/finance">) {
  const user = await requireModule("finance");
  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

  const current = currentMonthVN();
  const month = isValidMonth(one(params.m)) ? one(params.m)! : current;
  const walletId = UUID.test(one(params.w) ?? "") ? one(params.w) : undefined;
  const kind = KINDS.find((k) => k === one(params.k));
  const q = one(params.q)?.trim().slice(0, 60) || undefined;
  const filtered = !!(walletId || kind || q);

  const { transactions, summary, wallets } = await withTenant(user.id, async (tx) => ({
    transactions: await listTransactions(tx, user.id, { month, walletId, kind, q }),
    summary: await monthSummary(tx, user.id, month),
    wallets: await listWallets(tx, user.id),
  }));

  return (
    <Page
      title="Thu chi"
      description={formatMonthLabel(month)}
      actions={
        <>
          <MonthSwitcher month={month} current={current} />
          <AddTransactionButton className="hidden lg:inline-flex" />
        </>
      }
    >
      <MonthSummary income={summary.income} expense={summary.expense} />
      <TransactionFilters wallets={wallets} />
      {transactions.length ? (
        <TransactionList transactions={transactions} today={todayVN()} />
      ) : (
        <EmptyState
          icon={<ReceiptIcon weight="duotone" />}
          title={filtered ? "Không có giao dịch nào khớp bộ lọc" : `Chưa có giao dịch nào trong ${formatMonthLabel(month).toLowerCase()}`}
          description={filtered ? "Thử bỏ bớt bộ lọc hoặc đổi tháng." : "Ghi lại khoản chi hoặc khoản thu đầu tiên, chỉ mất vài giây."}
          action={filtered ? undefined : <AddTransactionButton />}
        />
      )}
      <AddTransactionFab />
    </Page>
  );
}
