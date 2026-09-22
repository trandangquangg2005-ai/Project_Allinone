import type { Metadata } from "next";
import { Logo } from "@/components/brand/logo";
import { requireUser } from "@/lib/auth/dal";
import { ChangePasswordForm } from "@/modules/auth/components/change-password-form";

export const metadata: Metadata = { title: "Đặt mật khẩu mới" };

export default async function ChangePasswordPage() {
  const user = await requireUser({ allowPasswordChange: true });
  return (
    <div className="grid gap-6">
      <div className="grid justify-items-center gap-3 text-center">
        <Logo size={56} withWordmark={false} />
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {user.mustChangePassword ? "Đặt mật khẩu của riêng bạn" : "Đổi mật khẩu"}
          </h1>
          <p className="mt-1 text-[15px] text-muted-foreground">
            {user.mustChangePassword
              ? "Mật khẩu hiện tại là mật khẩu tạm do quản trị viên đặt. Hãy đổi trước khi dùng."
              : "Các thiết bị khác sẽ phải đăng nhập lại."}
          </p>
        </div>
      </div>
      <div className="rounded-2xl border bg-card p-6 shadow-[0_1px_2px_rgb(15_23_42/0.04),0_12px_32px_-12px_rgb(15_23_42/0.12)]">
        <ChangePasswordForm redirectTo="/" />
      </div>
    </div>
  );
}
