import { MODULES, type ModuleKey } from "@/config/modules";

export type NavIconKey = "home" | ModuleKey | "admin" | "settings";

export type NavItem = {
  href: string;
  label: string;
  icon: NavIconKey;
  /** Match only the exact path (the dashboard). */
  exact?: boolean;
};

export type NavUser = {
  displayName: string;
  username: string;
  role: "admin" | "user";
  modules: ModuleKey[];
};

export function buildNav(user: NavUser): { primary: NavItem[]; admin: NavItem | null; settings: NavItem } {
  const modules = MODULES.filter((m) => user.modules.includes(m.key)).map<NavItem>((m) => ({
    href: m.href,
    label: m.label,
    icon: m.key,
  }));
  return {
    primary: [{ href: "/", label: "Tổng quan", icon: "home", exact: true }, ...modules],
    admin: user.role === "admin" ? { href: "/admin", label: "Quản trị", icon: "admin" } : null,
    settings: { href: "/settings", label: "Cài đặt", icon: "settings" },
  };
}

export function isActive(pathname: string, item: NavItem): boolean {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}
