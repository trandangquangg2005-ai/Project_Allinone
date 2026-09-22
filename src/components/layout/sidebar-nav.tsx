"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NavIcon } from "./nav-icon";
import { isActive, type NavItem } from "./nav-items";

export function SidebarNav({ groups }: { groups: NavItem[][] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Chính" className="grid gap-5">
      {groups.map((items, index) => (
        <ul key={index} className="grid gap-0.5">
          {items.map((item) => {
            const active = isActive(pathname, item);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  transitionTypes={["nav"]}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex h-10 items-center gap-3 rounded-xl px-3 text-[15px] transition-colors",
                    active ? "font-semibold text-sidebar-accent-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="sidebar-active"
                      className="absolute inset-0 rounded-xl bg-sidebar-accent"
                      transition={{ type: "spring", stiffness: 500, damping: 40 }}
                    />
                  )}
                  <NavIcon icon={item.icon} weight={active ? "fill" : "regular"} className="relative size-5" />
                  <span className="relative">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      ))}
    </nav>
  );
}
