"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NavIcon } from "./nav-icon";
import { isActive, type NavItem } from "./nav-items";

/** Phone tab bar: at most five destinations, thumb-reachable. */
export function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Chính"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/85 pb-safe backdrop-blur-xl supports-[backdrop-filter]:bg-background/70 lg:hidden"
    >
      <ul className="mx-auto grid max-w-md" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((item) => {
          const active = isActive(pathname, item);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                transitionTypes={["nav"]}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="bottom-active"
                    className="absolute top-2 h-8 w-14 rounded-full bg-accent"
                    transition={{ type: "spring", stiffness: 500, damping: 38 }}
                  />
                )}
                <NavIcon icon={item.icon} weight={active ? "fill" : "regular"} className="relative size-[22px]" />
                <span className="relative">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
