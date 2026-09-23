"use client";

import { ArrowClockwiseIcon, CameraIcon, CheckIcon, MapPinIcon, SpinnerIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, useTransition } from "react";
import { useNow } from "@/hooks/use-now";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ResponsiveDialog } from "@/components/ui-kit/responsive-dialog";
import { formatDateTime, formatTime } from "@/lib/datetime";
import { currentPosition, preparePhoto, type PreparedPhoto } from "@/lib/image-client";
import type { ActionResult } from "@/lib/action-result";

const GPS_KEY = "aio:record-location";

function readGpsPreference() {
  try {
    return localStorage.getItem(GPS_KEY) !== "0";
  } catch {
    return true;
  }
}

/**
 * Photo step shared by check-in and check-out: open the camera, stamp and
 * compress the photo, preview, then send it with the form fields.
 */
export function CaptureDialog({
  open,
  onOpenChange,
  title,
  description,
  stampLabel,
  studentName,
  getServerOffset,
  submitLabel,
  extra,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  stampLabel: string;
  studentName: string;
  /** Server clock minus device clock, in ms. */
  getServerOffset: () => number;
  submitLabel: (time: string) => string;
  extra?: React.ReactNode;
  onSubmit: (data: FormData) => Promise<ActionResult<unknown>>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<PreparedPhoto | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [gps, setGps] = useState(() => (typeof window === "undefined" ? true : readGpsPreference()));
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  const now = useNow(5_000);
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setProcessing(true);
    try {
      const at = new Date(Date.now() + getServerOffset());
      const prepared = await preparePhoto(file, { label: stampLabel, time: formatDateTime(at), studentName });
      setPhoto(prepared);
      setPreview(URL.createObjectURL(prepared.blob));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không xử lý được ảnh.");
    } finally {
      setProcessing(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function toggleGps(value: boolean) {
    setGps(value);
    try {
      localStorage.setItem(GPS_KEY, value ? "1" : "0");
    } catch {}
  }

  function submit(form: HTMLFormElement | null) {
    if (!photo) return;
    startTransition(async () => {
      const data = new FormData(form ?? undefined);
      data.set("photo", new File([photo.blob], `photo.${photo.extension}`, { type: photo.type }));
      data.set("deviceTime", new Date().toISOString());
      if (gps) {
        const position = await currentPosition();
        if (position) {
          data.set("lat", String(position.lat));
          data.set("lng", String(position.lng));
        }
      }
      const result = await onSubmit(data);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setDone(true);
      setTimeout(() => onOpenChange(false), 700);
    });
  }

  const formRef = useRef<HTMLFormElement>(null);

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(o) => !pending && onOpenChange(o)}
      title={title}
      description={description}
      footer={
        <Button size="lg" className="w-full sm:w-auto sm:px-8" disabled={!photo || pending || done} onClick={() => submit(formRef.current)}>
          {pending ? <SpinnerIcon className="size-5 animate-spin" /> : done ? <CheckIcon weight="bold" className="size-5" /> : null}
          {pending ? "Đang gửi ảnh…" : done ? "Xong" : submitLabel(now === null ? "" : formatTime(new Date(now + getServerOffset())))}
        </Button>
      }
    >
      <form ref={formRef} onSubmit={(e) => e.preventDefault()} className="grid grid-cols-1 gap-5">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(e) => onFile(e.target.files?.[0])}
          aria-label="Chụp ảnh"
        />

        <div className="relative overflow-hidden rounded-2xl">
          <AnimatePresence mode="wait" initial={false}>
            {preview ? (
              <motion.div key="preview" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
                <img src={preview} alt="Ảnh vừa chụp" className="max-h-[46dvh] w-full rounded-2xl bg-muted object-contain" />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="absolute top-3 right-3 bg-card/90 backdrop-blur"
                  onClick={() => inputRef.current?.click()}
                  disabled={pending}
                >
                  <ArrowClockwiseIcon className="size-4" /> Chụp lại
                </Button>
                <AnimatePresence>
                  {done && (
                    <motion.div
                      className="absolute inset-0 flex items-center justify-center rounded-2xl bg-income/80"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <motion.span
                        className="flex size-20 items-center justify-center rounded-full bg-white text-income"
                        initial={{ scale: 0.4 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 420, damping: 18 }}
                      >
                        <CheckIcon weight="bold" className="size-10" />
                      </motion.span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ) : (
              <motion.button
                key="camera"
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={processing}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                whileTap={{ scale: 0.98 }}
                className="grid aspect-[4/3] w-full place-items-center rounded-2xl border-2 border-dashed border-primary/30 bg-accent/50 text-primary transition-colors hover:bg-accent"
              >
                <span className="grid justify-items-center gap-3">
                  {processing ? <SpinnerIcon className="size-10 animate-spin" /> : <CameraIcon weight="duotone" className="size-12" />}
                  <span className="text-base font-semibold">{processing ? "Đang xử lý ảnh…" : "Mở camera để chụp"}</span>
                  <span className="text-[13px] text-muted-foreground">Ảnh được nén và đóng dấu giờ tự động</span>
                </span>
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {extra}

        <label className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3">
          <span className="flex items-center gap-2 text-sm">
            <MapPinIcon className="size-4 text-muted-foreground" />
            Ghi vị trí (chỉ bạn xem được)
          </span>
          <Switch checked={gps} onCheckedChange={toggleGps} />
        </label>
      </form>
    </ResponsiveDialog>
  );
}
