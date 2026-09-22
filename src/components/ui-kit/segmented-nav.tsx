"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type SegmentedNavItem = { href: string; label: string; exact?: boolean };

/** Section tabs inside a module; the active pill slides between tabs. */
export function SegmentedNav({ items, layoutId }: { items: SegmentedNavItem[]; layoutId: string }) {
  const pathname = usePathname();
  return (
    <nav className="scrollbar-none -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="inline-flex gap-1 rounded-2xl border bg-card p-1">
        {items.map((item) => {
          const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                transitionTypes={["nav"]}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-9 items-center rounded-xl px-3.5 text-sm font-medium whitespace-nowrap transition-colors",
                  active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {active && (
                  <motion.span
                    layoutId={layoutId}
                    className="absolute inset-0 rounded-xl bg-primary"
                    transition={{ type: "spring", stiffness: 520, damping: 40 }}
                  />
                )}
                <span className="relative">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
