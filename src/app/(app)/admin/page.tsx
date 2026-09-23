import type { Metadata } from "next";
import { Page } from "@/components/layout/page";
import { requireAdmin } from "@/lib/auth/dal";
import { AccountBoard } from "@/modules/admin/components/account-board";
import { AuditList } from "@/modules/admin/components/audit-list";
import { getStorageUsage, listAccounts, listAudit } from "@/modules/admin/queries";

export const metadata: Metadata = { title: "Quản trị" };

export default async function AdminPage() {
  const admin = await requireAdmin();
  const [accounts, audit, usage] = await Promise.all([listAccounts(), listAudit(), getStorageUsage()]);
  const usedPercent = Math.min(100, Math.round((usage.bytes / usage.limit) * 1000) / 10);
  return (
    <Page title="Tài khoản" description="Tạo tài khoản, bật tắt chức năng và khóa khi cần. Dữ liệu của từng tài khoản luôn tách riêng.">
      <AccountBoard accounts={accounts} currentUserId={admin.actor?.id ?? admin.id} />
      <section className="mt-8 grid gap-2 rounded-2xl border bg-card p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="font-semibold">Dung lượng cơ sở dữ liệu</h2>
          <p className="text-sm text-muted-foreground">
            <span data-money className="font-medium text-foreground">
              {(usage.bytes / 1024 / 1024).toFixed(1)} MB
            </span>{" "}
            / 512 MB · {usedPercent}%
          </p>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={usedPercent > 80 ? "h-full rounded-full bg-destructive" : "h-full rounded-full bg-primary"}
            style={{ width: `${Math.max(usedPercent, 1)}%` }}
          />
        </div>
        <p className="text-[13px] text-muted-foreground">
          Gói Neon miễn phí dừng ghi khi đầy 512 MB. Ảnh chấm công không nằm ở đây mà ở kho ảnh riêng.
        </p>
      </section>

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
