import type { Metadata } from "next";
import { Page } from "@/components/layout/page";
import { requireAdmin } from "@/lib/auth/dal";
import { AccountBoard } from "@/modules/admin/components/account-board";
import { AuditList } from "@/modules/admin/components/audit-list";
import { listAccounts, listAudit } from "@/modules/admin/queries";

export const metadata: Metadata = { title: "Quản trị" };

export default async function AdminPage() {
  const admin = await requireAdmin();
  const [accounts, audit] = await Promise.all([listAccounts(), listAudit()]);
  return (
    <Page title="Tài khoản" description="Tạo tài khoản, bật tắt chức năng và khóa khi cần. Dữ liệu của từng tài khoản luôn tách riêng.">
      <AccountBoard accounts={accounts} currentUserId={admin.actor?.id ?? admin.id} />
      <section className="mt-10 grid gap-3">
        <div>
          <h2 className="text-lg font-semibold">Nhật ký quản trị</h2>
          <p className="text-sm text-muted-foreground">Ghi lại việc quản trị viên mở và sửa dữ liệu của tài khoản khác. Tự xóa sau 90 ngày.</p>
        </div>
        <AuditList entries={audit} />
      </section>
    </Page>
  );
}
