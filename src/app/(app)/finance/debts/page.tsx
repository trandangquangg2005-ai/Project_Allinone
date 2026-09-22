import type { Metadata } from "next";
import { Page } from "@/components/layout/page";
import { withTenant } from "@/db";
import { requireModule } from "@/lib/auth/dal";
import { DebtBoard } from "@/modules/finance/components/debt-board";
import { listAllDebtPayments, listDebts, listWallets } from "@/modules/finance/queries";

export const metadata: Metadata = { title: "Khoản nợ" };

export default async function DebtsPage() {
  const user = await requireModule("finance");
  const data = await withTenant(user.id, async (tx) => ({
    debts: await listDebts(tx, user.id),
    payments: await listAllDebtPayments(tx, user.id),
    wallets: await listWallets(tx, user.id),
  }));
  return (
    <Page title="Khoản nợ" description="Tiền cho mượn cần đòi và tiền mình đang nợ, kèm từng lần trả.">
      <DebtBoard debts={data.debts} payments={data.payments} wallets={data.wallets} />
    </Page>
  );
}
