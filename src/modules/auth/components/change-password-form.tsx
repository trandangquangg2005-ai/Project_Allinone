"use client";

import { SpinnerIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Field } from "@/components/form/field";
import { PasswordInput } from "@/components/form/password-input";
import { Button } from "@/components/ui/button";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/password-rules";
import { changePassword } from "../actions";

export function ChangePasswordForm({ redirectTo }: { redirectTo?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    startTransition(async () => {
      const result = await changePassword({
        currentPassword: String(data.get("currentPassword") ?? ""),
        newPassword: String(data.get("newPassword") ?? ""),
        confirmPassword: String(data.get("confirmPassword") ?? ""),
      });
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        setFormError(result.fieldErrors && Object.keys(result.fieldErrors).length ? undefined : result.error);
        return;
      }
      setErrors({});
      setFormError(undefined);
      form.reset();
      toast.success("Đã đổi mật khẩu");
      if (redirectTo) router.replace(redirectTo);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5">
      <Field label="Mật khẩu hiện tại" htmlFor="currentPassword" error={errors.currentPassword}>
        <PasswordInput id="currentPassword" name="currentPassword" autoComplete="current-password" required />
      </Field>
      <Field
        label="Mật khẩu mới"
        htmlFor="newPassword"
        error={errors.newPassword}
        hint={`Ít nhất ${PASSWORD_MIN_LENGTH} ký tự. Nên dùng một câu ngắn dễ nhớ.`}
      >
        <PasswordInput id="newPassword" name="newPassword" autoComplete="new-password" required />
      </Field>
      <Field label="Nhập lại mật khẩu mới" htmlFor="confirmPassword" error={errors.confirmPassword}>
        <PasswordInput id="confirmPassword" name="confirmPassword" autoComplete="new-password" required />
      </Field>
      {formError && (
        <p role="alert" className="rounded-xl bg-expense-soft px-3.5 py-2.5 text-sm text-expense">
          {formError}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending}>
        {pending && <SpinnerIcon className="size-5 animate-spin" />}
        Lưu mật khẩu mới
      </Button>
    </form>
  );
}
