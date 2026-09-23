"use client";

import { XIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { createContext, use, useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

type Photo = { id: string; src: string; caption: string };
const LightboxContext = createContext<{ show: (photo: Photo) => void } | null>(null);

/** One lightbox per page; thumbnails morph into it (shared layoutId). */
export function LightboxProvider({ children }: { children: React.ReactNode }) {
  const [photo, setPhoto] = useState<Photo | null>(null);
  const show = useCallback((p: Photo) => setPhoto(p), []);
  const value = useMemo(() => ({ show }), [show]);

  useEffect(() => {
    if (!photo) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPhoto(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [photo]);

  return (
    <LightboxContext value={value}>
      {children}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {photo && (
              <motion.div
                key="backdrop"
                className="fixed inset-0 z-[60] grid overflow-y-auto overscroll-contain bg-black/85 p-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setPhoto(null)}
                role="dialog"
                aria-modal="true"
                aria-label={photo.caption}
              >
                <motion.figure layoutId={`photo-${photo.id}`} className="m-auto grid max-w-3xl gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element -- private photo streamed by our route; must not go through the image optimiser */}
                  <img src={photo.src} alt={photo.caption} className="max-h-[calc(100dvh-6rem)] w-auto rounded-2xl object-contain" />
                  <figcaption className="text-center text-sm text-white/85">{photo.caption}</figcaption>
                </motion.figure>
                <button
                  type="button"
                  className="absolute top-4 right-4 flex size-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur"
                  aria-label="Đóng"
                >
                  <XIcon className="size-5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </LightboxContext>
  );
}

export function PhotoThumb({
  id,
  src,
  caption,
  label,
  className,
}: {
  id: string;
  src: string;
  caption: string;
  label: string;
  className?: string;
}) {
  const ctx = use(LightboxContext);
  return (
    <button
      type="button"
      onClick={() => ctx?.show({ id, src, caption })}
      className={cn("group relative overflow-hidden rounded-xl bg-muted", className)}
      aria-label={`Xem ảnh ${label}`}
    >
      <motion.span layoutId={`photo-${id}`} className="block size-full">
        {/* eslint-disable-next-line @next/next/no-img-element -- private photo streamed by our route */}
        <img src={src} alt="" loading="lazy" decoding="async" className="size-full object-cover transition-transform duration-300 group-hover:scale-105" />
      </motion.span>
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-1.5 pt-3 pb-1 text-left text-[10px] font-semibold text-white">
        {label}
      </span>
    </button>
  );
}
