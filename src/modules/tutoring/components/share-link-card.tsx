"use client";

import { ArrowsClockwiseIcon, CopyIcon, LinkIcon, LinkBreakIcon, ShareNetworkIcon, SpinnerIcon } from "@phosphor-icons/react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui-kit/confirm-dialog";
import { canShare, copyText } from "@/lib/browser";
import { useOrigin } from "@/hooks/use-origin";
import { formatDateTime } from "@/lib/datetime";
import { regenerateShareLink, revokeShareLink } from "../actions";

export function ShareLinkCard({
  studentId,
  studentName,
  token,
  lastViewedAt,
  archived,
}: {
  studentId: string;
  studentName: string;
  token: string | null;
  lastViewedAt: Date | null;
  archived: boolean;
}) {
  const [confirm, setConfirm] = useState<"regenerate" | "revoke" | null>(null);
  const [pending, startTransition] = useTransition();
  const origin = useOrigin();
  const url = token ? `${origin}/p/${token}` : null;

  function create() {
    startTransition(async () => {
      const result = await regenerateShareLink({ studentId });
      if (!result.ok) return void toast.error(result.error);
      toast.success(token ? "Đã đổi link. Link cũ không còn dùng được." : "Đã tạo link cho phụ huynh");
    });
  }

  async function copy() {
    if (!url) return;
    if (await copyText(url))
      toast.success("Đã chép link", { description: "Gửi cho phụ huynh qua Zalo hoặc tin nhắn." });
    else toast.error("Không chép được link. Hãy bấm giữ vào link để chép thủ công.");
  }

  async function share() {
    if (!url) return;
    if (canShare()) {
      try {
        await navigator.share({ title: `Sổ theo dõi buổi học của ${studentName}`, url });
        return;
      } catch {
        // cancelled
      }
    }
    await copy();
  }

  return (
    <section className="grid gap-4 rounded-2xl border bg-card p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="hex flex size-10 shrink-0 items-center justify-center bg-accent text-primary">
          <LinkIcon weight="duotone" className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 className="font-semibold">Link cho phụ huynh</h2>
          <p className="text-[13px] text-muted-foreground">
            Phụ huynh mở link là xem được các buổi học, ảnh check-in/out và học phí, không cần tài khoản.
          </p>
        </div>
      </div>

      {token && url ? (
        <>
          <div className="flex items-center gap-2 rounded-xl border bg-muted/50 px-3 py-2.5">
            <code className="min-w-0 flex-1 truncate text-[13px]">{url}</code>
          </div>
          <p className="text-[13px] text-muted-foreground">
            {lastViewedAt ? `Phụ huynh xem lần gần nhất lúc ${formatDateTime(lastViewedAt)}.` : "Phụ huynh chưa mở link này."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={share}>
              <ShareNetworkIcon className="size-4" /> Gửi link
            </Button>
            <Button variant="outline" onClick={copy}>
              <CopyIcon className="size-4" /> Sao chép
            </Button>
            <Button variant="ghost" disabled={pending} onClick={() => setConfirm("regenerate")}>
              <ArrowsClockwiseIcon className="size-4" /> Đổi link
            </Button>
            <Button variant="ghost" disabled={pending} className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setConfirm("revoke")}>
              <LinkBreakIcon className="size-4" /> Tắt link
            </Button>
          </div>
        </>
      ) : (
        <Button onClick={create} disabled={pending || archived} className="w-fit">
          {pending && <SpinnerIcon className="size-4 animate-spin" />}
          Tạo link cho phụ huynh
        </Button>
      )}

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm === "revoke" ? "Tắt link phụ huynh?" : "Đổi sang link mới?"}
        description={
          confirm === "revoke"
            ? "Link hiện tại sẽ ngừng hoạt động. Bạn có thể tạo link mới bất cứ lúc nào."
            : "Link cũ sẽ ngừng hoạt động ngay. Nhớ gửi link mới cho phụ huynh."
        }
        confirmLabel={confirm === "revoke" ? "Tắt link" : "Đổi link"}
        onConfirm={() => {
          if (confirm === "revoke") {
            startTransition(async () => {
              const result = await revokeShareLink({ studentId });
              if (!result.ok) toast.error(result.error);
              else toast.success("Đã tắt link");
            });
          } else create();
        }}
      />
    </section>
  );
}
