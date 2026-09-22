/**
 * Module registry. Adding a module = add an entry here, a route folder under
 * src/app/(app)/<href>, and a `requireModule("<key>")` in its layout.
 * Accounts are granted modules by key (users.modules).
 */
export const MODULES = [
  {
    key: "finance",
    label: "Tài chính",
    description: "Thu chi theo ví, khoản nợ, báo cáo hằng tháng",
    href: "/finance",
  },
  {
    key: "tutoring",
    label: "Gia sư",
    description: "Học sinh, chấm công bằng ảnh, học phí, link cho phụ huynh",
    href: "/tutoring",
  },
] as const;

export type ModuleKey = (typeof MODULES)[number]["key"];

export const MODULE_KEYS: ModuleKey[] = MODULES.map((m) => m.key);

export function isModuleKey(value: string): value is ModuleKey {
  return (MODULE_KEYS as string[]).includes(value);
}

export function getModule(key: ModuleKey) {
  return MODULES.find((m) => m.key === key)!;
}
