import type { Metadata } from "next";
import { Page } from "@/components/layout/page";
import { requireAdmin } from "@/lib/auth/dal";
import { AccountBoard } from "@/modules/admin/components/account-board";
import { listAccounts } from "@/modules/admin/queries";

export const metadata: Metadata = { title: "Quản trị" };

export default async function AdminPage() {
  const admin = await requireAdmin();
  const accounts = await listAccounts();
  return (
    <Page title="Tài khoản" description="Tạo tài khoản, bật tắt chức năng và khóa khi cần. Dữ liệu của từng tài khoản luôn tách riêng.">
      <AccountBoard accounts={accounts} currentUserId={admin.id} />
    </Page>
  );
}
