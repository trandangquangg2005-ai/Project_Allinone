import { SegmentedNav } from "@/components/ui-kit/segmented-nav";
import { withTenant } from "@/db";
import { requireModule } from "@/lib/auth/dal";
import { TransactionProvider } from "@/modules/finance/components/transaction-provider";
import { listCategories, listWallets } from "@/modules/finance/queries";

const TABS = [
  { href: "/finance", label: "Giao dịch", exact: true },
  { href: "/finance/wallets", label: "Ví" },
  { href: "/finance/debts", label: "Khoản nợ" },
  { href: "/finance/reports", label: "Báo cáo" },
  { href: "/finance/categories", label: "Danh mục" },
];

export default async function FinanceLayout({ children }: LayoutProps<"/finance">) {
  const user = await requireModule("finance");
  const { wallets, categories } = await withTenant(user.id, async (tx) => ({
    wallets: await listWallets(tx, user.id, { includeArchived: true }),
    categories: await listCategories(tx, user.id, { includeArchived: true }),
  }));

  return (
    <TransactionProvider wallets={wallets} categories={categories}>
      <div className="grid gap-6">
        <SegmentedNav items={TABS} layoutId="finance-tab" />
        {children}
      </div>
    </TransactionProvider>
  );
}
