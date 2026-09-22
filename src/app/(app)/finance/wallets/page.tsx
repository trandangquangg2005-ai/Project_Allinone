import type { Metadata } from "next";
import { Page } from "@/components/layout/page";
import { withTenant } from "@/db";
import { requireModule } from "@/lib/auth/dal";
import { WalletBoard } from "@/modules/finance/components/wallet-board";
import { listWallets } from "@/modules/finance/queries";

export const metadata: Metadata = { title: "Ví" };

export default async function WalletsPage() {
  const user = await requireModule("finance");
  const wallets = await withTenant(user.id, (tx) => listWallets(tx, user.id, { includeArchived: true }));
  return (
    <Page title="Ví của bạn" description="Số dư được tính từ số dư ban đầu và mọi giao dịch của từng ví.">
      <WalletBoard wallets={wallets} />
    </Page>
  );
}
