"use client";

import { SpinnerIcon } from "@phosphor-icons/react";
import { motion } from "motion/react";
import { useActionState } from "react";
import { AnimatedMark } from "@/components/brand/animated-mark";
import { Field } from "@/components/form/field";
import { PasswordInput } from "@/components/form/password-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { login, type LoginState } from "@/modules/auth/actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});

  return (
    <div className="grid gap-8">
      <div className="grid justify-items-center gap-3 text-center">
        <AnimatedMark size={76} />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AIO</h1>
          <p className="mt-1 text-[15px] text-muted-foreground">Đăng nhập để mở sổ của bạn</p>
        </div>
      </div>

      <motion.form
        action={action}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="grid gap-5 rounded-2xl border bg-card p-6 shadow-[0_1px_2px_rgb(15_23_42/0.04),0_12px_32px_-12px_rgb(15_23_42/0.12)]"
      >
        <input type="hidden" name="next" value={next} />
        <Field label="Tên đăng nhập" htmlFor="username">
          <Input
            id="username"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            defaultValue={state.username}
            required
            autoFocus
          />
        </Field>
        <Field label="Mật khẩu" htmlFor="password">
          <PasswordInput id="password" name="password" autoComplete="current-password" required />
        </Field>

        {state.error && (
          <p role="alert" className="rounded-xl bg-expense-soft px-3.5 py-2.5 text-sm text-expense">
            {state.error}
          </p>
        )}

        <Button type="submit" size="lg" disabled={pending} className="w-full">
          {pending && <SpinnerIcon className="size-5 animate-spin" />}
          Đăng nhập
        </Button>
      </motion.form>

      <p className="text-center text-[13px] text-muted-foreground">
        Chưa có tài khoản? Hãy nhờ quản trị viên tạo cho bạn.
      </p>
    </div>
  );
}
