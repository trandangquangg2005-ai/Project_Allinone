"use client";

import { motion } from "motion/react";
import { CategoryGlyph } from "@/components/ui-kit/category-icons";
import { HexBadge } from "@/components/ui-kit/hex-badge";
import { formatVND } from "@/lib/money";

type Row = { categoryId: string; name: string; icon: string; color: string; total: number; count: number };

/** Ranked list with proportional bars: easier to read than a pie on a phone. */
export function CategoryBreakdown({ rows, emptyText }: { rows: Row[]; emptyText: string }) {
  const total = rows.reduce((s, r) => s + r.total, 0);
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted-foreground">{emptyText}</p>;
  return (
    <ul className="grid gap-4">
      {rows.map((row, i) => {
        const share = total > 0 ? row.total / total : 0;
        return (
          <li key={row.categoryId} className="grid gap-2">
            <div className="flex items-center gap-3">
              <HexBadge color={row.color} size="sm">
                <CategoryGlyph icon={row.icon} />
              </HexBadge>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium">{row.name}</span>
                <span className="block text-[13px] text-muted-foreground">{row.count} giao dịch</span>
              </span>
              <span className="text-right">
                <span data-money className="block font-semibold">{formatVND(row.total)}</span>
                <span className="tabular block text-[13px] text-muted-foreground">{Math.round(share * 100)}%</span>
              </span>
            </div>
            <div className="ml-11 h-1.5 overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: `var(--swatch-${row.color}, var(--swatch-slate))` }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(share * 100, 2)}%` }}
                transition={{ duration: 0.7, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
