"use client";

import { EyeIcon, SignOutIcon, SpinnerIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { stopViewAs } from "@/modules/admin/actions";

/**
 * Always-on reminder that what is on screen belongs to someone else.
 * Sticks under the mobile header, and at the top on desktop.
 */
export function ViewAsBanner({ username, adminName }: { username: string; adminName: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="sticky top-14 z-40 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-amber-300/60 bg-amber-100/95 px-4 py-2 text-amber-950 backdrop-blur-xl sm:px-6 lg:top-0 lg:px-10 dark:border-amber-500/30 dark:bg-amber-950/90 dark:text-amber-100">
      <EyeIcon weight="fill" className="size-4 shrink-0" />
      <p className="min-w-0 flex-1 text-[13px] leading-snug">
        Đang xem dữ liệu của <strong className="font-semibold">@{username}</strong> với quyền quản trị của{" "}
        <span className="whitespace-nowrap">@{adminName}</span>. Mọi thay đổi đều được ghi nhật ký.
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await stopViewAs({});
            if (!result.ok) return void toast.error(result.error);
            toast.success("Đã quay lại tài khoản của bạn");
            router.push("/admin");
          })
        }
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-amber-950/10 px-3 py-1 text-[13px] font-medium transition-colors hover:bg-amber-950/20 disabled:opacity-60 dark:bg-amber-100/10 dark:hover:bg-amber-100/20"
      >
        {pending ? <SpinnerIcon className="size-3.5 animate-spin" /> : <SignOutIcon className="size-3.5" />}
        Thoát
      </button>
    </div>
  );
}
