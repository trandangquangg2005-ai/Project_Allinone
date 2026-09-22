import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { BottomNav } from "./bottom-nav";
import { buildNav, type NavUser } from "./nav-items";
import { SidebarNav } from "./sidebar-nav";
import { UserMenu } from "./user-menu";

export function AppShell({ user, children }: { user: NavUser; children: React.ReactNode }) {
  const nav = buildNav(user);
  const sidebarGroups = [nav.primary, [...(nav.admin ? [nav.admin] : []), nav.settings]];

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[252px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-sidebar-border bg-sidebar px-3 pt-5 pb-3 lg:flex">
        <Link href="/" transitionTypes={["nav"]} className="mb-7 flex items-center px-3">
          <Logo size={30} />
        </Link>
        <div className="flex-1 overflow-y-auto">
          <SidebarNav groups={sidebarGroups} />
        </div>
        <div className="border-t border-sidebar-border pt-3">
          <UserMenu user={user} variant="sidebar" />
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/80 px-4 pt-safe backdrop-blur-xl lg:hidden">
          <Link href="/" transitionTypes={["nav"]} aria-label="Tổng quan">
            <Logo size={26} />
          </Link>
          <UserMenu user={user} variant="compact" />
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 pt-5 pb-28 sm:px-6 lg:px-10 lg:pt-10 lg:pb-16">{children}</main>
      </div>

      <BottomNav items={[...nav.primary, nav.settings]} />
    </div>
  );
}
