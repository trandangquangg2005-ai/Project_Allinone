import { CaretRightIcon, ShieldCheckIcon } from "@phosphor-icons/react/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { Page } from "@/components/layout/page";
import { withTenant } from "@/db";
import { requireUser } from "@/lib/auth/dal";
import { ChangePasswordForm } from "@/modules/auth/components/change-password-form";
import { AutoIncomeSwitch, BankForm, ProfileForm, SignOutOthersButton, ThemePicker } from "@/modules/settings/components/settings-forms";
import { getBankSettings } from "@/modules/tutoring/queries";

export const metadata: Metadata = { title: "Cài đặt" };

export default async function SettingsPage() {
  const user = await requireUser();
  const hasTutoring = user.modules.includes("tutoring");
  const settings = hasTutoring ? await withTenant(user.id, (tx) => getBankSettings(tx, user.id)) : null;

  return (
    <Page title="Cài đặt" description={`Đăng nhập với tên @${user.username}`}>
      {user.role === "admin" && (
        <Link
          href="/admin"
          transitionTypes={["nav"]}
          className="flex items-center gap-3 rounded-2xl border bg-card px-5 py-4 transition-colors hover:border-primary/30 lg:hidden"
        >
          <ShieldCheckIcon weight="duotone" className="size-6 text-primary" />
          <span className="flex-1">
            <span className="block font-semibold">Quản trị tài khoản</span>
            <span className="block text-[13px] text-muted-foreground">Tạo tài khoản, bật tắt chức năng</span>
          </span>
          <CaretRightIcon className="size-4 text-muted-foreground" />
        </Link>
      )}

      <Section title="Hồ sơ">
        <ProfileForm displayName={user.displayName} />
      </Section>

      <Section title="Giao diện">
        <ThemePicker />
      </Section>

      {settings && (
        <Section
          title="Nhận học phí"
          description="Phụ huynh sẽ thấy mã VietQR với đúng số tiền còn thiếu trên trang theo dõi của con."
        >
          <BankForm bankBin={settings.bankBin} bankAccountNumber={settings.bankAccountNumber} bankAccountName={settings.bankAccountName} />
          {user.modules.includes("finance") && <AutoIncomeSwitch enabled={settings.tuitionAutoIncome} />}
        </Section>
      )}

      <Section title="Mật khẩu và đăng nhập">
        <ChangePasswordForm />
        <div className="border-t pt-4">
          <SignOutOthersButton />
        </div>
      </Section>

      <Section title="Dùng như một ứng dụng">
        <ul className="grid gap-2 text-[15px] text-muted-foreground">
          <li>iPhone: mở AIO bằng Safari, bấm nút Chia sẻ rồi chọn “Thêm vào MH chính”.</li>
          <li>Android: mở bằng Chrome, bấm menu ⋮ rồi chọn “Cài đặt ứng dụng”.</li>
        </ul>
      </Section>
    </Page>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 rounded-2xl border bg-card p-4 sm:p-6">
      <div>
        <h2 className="font-semibold">{title}</h2>
        {description && <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}
