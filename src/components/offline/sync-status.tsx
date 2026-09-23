"use client";

import { ArrowClockwiseIcon, CheckCircleIcon, CloudArrowUpIcon, CloudSlashIcon, TrashIcon, WarningIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { ResponsiveDialog } from "@/components/ui-kit/responsive-dialog";
import { discard, getOfflineState, retry, subscribeOffline, type OfflineState } from "@/lib/offline/queue";
import { cn } from "@/lib/utils";

const EMPTY: OfflineState = { online: true, syncing: false, pending: [], failed: [] };

export function SyncStatus() {
  const state = useSyncExternalStore(subscribeOffline, getOfflineState, () => EMPTY);
  const [details, setDetails] = useState(false);
  const [justSynced, setJustSynced] = useState(false);
  const previous = useRef(0);
  const router = useRouter();

  const waiting = state.pending.length;
  const failed = state.failed.length;

  useEffect(() => {
    // Everything that was waiting has gone through: say so, then refresh the
    // page so the server's version replaces what was shown from the queue.
    if (previous.current > 0 && waiting === 0 && failed === 0) {
      setJustSynced(true);
      router.refresh();
      const timer = setTimeout(() => setJustSynced(false), 4000);
      previous.current = waiting;
      return () => clearTimeout(timer);
    }
    previous.current = waiting;
  }, [waiting, failed, router]);

  const visible = !state.online || waiting > 0 || failed > 0 || justSynced;
  const tone = failed > 0 ? "danger" : !state.online ? "muted" : justSynced && !waiting ? "ok" : "info";

  return (
    <>
      <AnimatePresence>
        {visible && (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            onClick={() => (waiting || failed) && setDetails(true)}
            className={cn(
              "fixed bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border px-3.5 py-2 text-[13px] font-medium shadow-lg backdrop-blur-xl lg:bottom-5 lg:left-auto lg:right-6 lg:translate-x-0",
              tone === "danger" && "border-destructive/30 bg-destructive/10 text-destructive",
              tone === "muted" && "border-border bg-muted/90 text-muted-foreground",
              tone === "ok" && "border-emerald-500/30 bg-emerald-50/95 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300",
              tone === "info" && "border-primary/25 bg-primary/10 text-primary",
            )}
          >
            {failed > 0 ? (
              <>
                <WarningIcon weight="fill" className="size-4" /> {failed} thao tác chưa gửi được
              </>
            ) : state.syncing ? (
              <>
                <CloudArrowUpIcon className="size-4 animate-pulse" /> Đang gửi {waiting} thay đổi…
              </>
            ) : !state.online ? (
              <>
                <CloudSlashIcon className="size-4" />
                {waiting > 0 ? `Ngoại tuyến · ${waiting} chờ gửi` : "Ngoại tuyến · vẫn dùng được"}
              </>
            ) : waiting > 0 ? (
              <>
                <CloudArrowUpIcon className="size-4" /> {waiting} thay đổi chờ gửi
              </>
            ) : (
              <>
                <CheckCircleIcon weight="fill" className="size-4" /> Đã đồng bộ
              </>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      <ResponsiveDialog
        open={details}
        onOpenChange={setDetails}
        title="Thay đổi chờ gửi"
        description="Những thao tác này đã lưu trên máy và sẽ tự gửi lên khi có mạng."
      >
        <ul className="grid gap-2">
          {[...state.pending, ...state.failed].map((op) => {
            const isFailed = state.failed.some((f) => f.id === op.id);
            return (
              <li key={op.id} className="grid gap-2 rounded-xl border p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{op.label}</span>
                  <time className="shrink-0 text-[12px] text-muted-foreground">
                    {new Date(op.createdAt).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}
                  </time>
                </div>
                {isFailed && (
                  <>
                    <p className="text-[13px] text-destructive">{op.lastError ?? "Máy chủ từ chối thao tác này."}</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => void retry(op.id)}>
                        <ArrowClockwiseIcon className="size-3.5" /> Thử lại
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => void discard(op.id)}>
                        <TrashIcon className="size-3.5" /> Bỏ
                      </Button>
                    </div>
                  </>
                )}
              </li>
            );
          })}
          {!state.pending.length && !state.failed.length && (
            <li className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">Không còn gì chờ gửi.</li>
          )}
        </ul>
      </ResponsiveDialog>
    </>
  );
}
