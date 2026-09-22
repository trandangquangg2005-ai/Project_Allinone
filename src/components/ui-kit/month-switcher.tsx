"use client";

import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { formatMonthLabel, shiftMonth } from "@/lib/datetime";
import { cn } from "@/lib/utils";

/** Prev/next month links that keep the other query parameters. */
export function MonthSwitcher({ month, current, param = "m", className }: { month: string; current: string; param?: string; className?: string }) {
  const pathname = usePathname();
  const params = useSearchParams();

  function href(target: string) {
    const next = new URLSearchParams(params.toString());
    if (target === current) next.delete(param);
    else next.set(param, target);
    const query = next.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  const atCurrent = month >= current;
  return (
    <div className={cn("inline-flex items-center gap-1 rounded-xl border bg-card p-1", className)}>
      <Link
        href={href(shiftMonth(month, -1))}
        scroll={false}
        className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        aria-label="Tháng trước"
      >
        <CaretLeftIcon className="size-4" />
      </Link>
      <Link
        href={href(current)}
        scroll={false}
        className="tabular min-w-[112px] rounded-lg px-2 py-1.5 text-center text-sm font-semibold"
        title="Về tháng này"
      >
        {formatMonthLabel(month)}
      </Link>
      {atCurrent ? (
        <span className="flex size-9 items-center justify-center text-muted-foreground/40" aria-hidden>
          <CaretRightIcon className="size-4" />
        </span>
      ) : (
        <Link
          href={href(shiftMonth(month, 1))}
          scroll={false}
          className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Tháng sau"
        >
          <CaretRightIcon className="size-4" />
        </Link>
      )}
    </div>
  );
}
