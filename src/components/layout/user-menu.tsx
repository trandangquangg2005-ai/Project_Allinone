"use client";

import { GearSixIcon, MoonIcon, ShieldCheckIcon, SignOutIcon, SunIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { logout } from "@/modules/auth/actions";
import type { NavUser } from "./nav-items";

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : name.slice(0, 2);
  return letters.toUpperCase();
}

export function UserMenu({ user, variant }: { user: NavUser; variant: "sidebar" | "compact" }) {
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === "dark";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex items-center gap-3 rounded-xl text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          variant === "sidebar" ? "w-full p-2 hover:bg-sidebar-accent" : "p-1",
        )}
        aria-label="Tài khoản"
      >
        <span className="hex flex size-9 shrink-0 items-center justify-center bg-primary text-[13px] font-semibold text-primary-foreground">
          {initials(user.displayName)}
        </span>
        {variant === "sidebar" && (
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{user.displayName}</span>
            <span className="block truncate text-[13px] text-muted-foreground">@{user.username}</span>
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={variant === "sidebar" ? "start" : "end"} side={variant === "sidebar" ? "top" : "bottom"} className="w-60">
        <DropdownMenuLabel className="grid">
          <span className="truncate">{user.displayName}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">@{user.username}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings" transitionTypes={["nav"]}>
            <GearSixIcon /> Cài đặt
          </Link>
        </DropdownMenuItem>
        {user.role === "admin" && (
          <DropdownMenuItem asChild className="lg:hidden">
            <Link href="/admin" transitionTypes={["nav"]}>
              <ShieldCheckIcon /> Quản trị tài khoản
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => setTheme(dark ? "light" : "dark")}>
          {dark ? <SunIcon /> : <MoonIcon />} {dark ? "Giao diện sáng" : "Giao diện tối"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void logout()} variant="destructive">
          <SignOutIcon /> Đăng xuất
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
