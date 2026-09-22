"use client";

import { useNow } from "@/hooks/use-now";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** hh:mm:ss since `since`, ticking every second. */
export function LiveTimer({ since, className }: { since: Date; className?: string }) {
  const now = useNow(1000);
  const elapsed = Math.max(0, Math.floor(((now ?? since.getTime()) - since.getTime()) / 1000));
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  return (
    <span className={className} data-money suppressHydrationWarning>
      {pad(h)}:{pad(m)}:{pad(s)}
    </span>
  );
}
