"use client";

import { CheckCircleIcon, ImageBrokenIcon, SpinnerIcon } from "@phosphor-icons/react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { testPhotoStorage } from "../actions";

type Result = { ok: true; where: string } | { ok: false; error: string };

/**
 * Check-in fails as soon as photos cannot be stored, and the cause is on the
 * server. This says so in one click instead of one failed lesson.
 */
export function StorageCheck() {
  const [result, setResult] = useState<Result | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="grid gap-3 rounded-2xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Kho ảnh chấm công</h2>
          <p className="text-sm text-muted-foreground">Thử lưu và xóa một tệp nhỏ để chắc chắn ảnh check-in lưu được.</p>
        </div>
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const response = await testPhotoStorage({});
              setResult(response.ok ? response.data : { ok: false, error: response.error });
            })
          }
        >
          {pending ? <SpinnerIcon className="size-4 animate-spin" /> : null} Kiểm tra
        </Button>
      </div>

      {result &&
        (result.ok ? (
          <p className="flex items-start gap-2 rounded-xl bg-emerald-500/10 p-3 text-[13px] text-emerald-700 dark:text-emerald-300">
            <CheckCircleIcon weight="fill" className="mt-0.5 size-4 shrink-0" />
            Lưu ảnh bình thường — đang dùng {result.where}.
          </p>
        ) : (
          <p className="flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-[13px] text-destructive">
            <ImageBrokenIcon weight="fill" className="mt-0.5 size-4 shrink-0" />
            {result.error}
          </p>
        ))}
    </div>
  );
}
