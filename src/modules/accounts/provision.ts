import { and, eq } from "drizzle-orm";
import type { Tx } from "@/db/client";
import { categories, userSettings, wallets } from "@/db/schema";

// Framework-free so the seed script can reuse it. Must run inside
// runAsTenant/withTenant(userId) — RLS rejects rows for any other account.

export const DEFAULT_WALLETS = [
  { name: "Tiền mặt", kind: "cash", color: "green" },
  { name: "Ngân hàng", kind: "bank", color: "blue" },
] as const;

type CategorySeed = { name: string; icon: string; color: string; systemKey?: string };

export const DEFAULT_EXPENSE_CATEGORIES: CategorySeed[] = [
  { name: "Ăn uống", icon: "food", color: "coral" },
  { name: "Cà phê, đồ uống", icon: "coffee", color: "amber" },
  { name: "Đi lại", icon: "motorbike", color: "blue" },
  { name: "Xăng xe", icon: "fuel", color: "slate" },
  { name: "Mua sắm", icon: "shopping", color: "pink" },
  { name: "Nhà cửa", icon: "home", color: "teal" },
  { name: "Hóa đơn, tiện ích", icon: "bill", color: "violet" },
  { name: "Điện thoại, Internet", icon: "phone", color: "blue" },
  { name: "Học tập", icon: "study", color: "green" },
  { name: "Sức khỏe", icon: "health", color: "coral" },
  { name: "Giải trí", icon: "game", color: "violet" },
  { name: "Hiếu hỉ, quà tặng", icon: "gift", color: "pink" },
  { name: "Gia đình", icon: "family", color: "teal" },
  { name: "Khác", icon: "other", color: "slate" },
];

export const TUITION_CATEGORY: CategorySeed = {
  name: "Học phí gia sư",
  icon: "tutoring",
  color: "green",
  systemKey: "tuition",
};

export const DEFAULT_INCOME_CATEGORIES: CategorySeed[] = [
  { name: "Lương", icon: "salary", color: "green" },
  TUITION_CATEGORY,
  { name: "Thưởng", icon: "bonus", color: "amber" },
  { name: "Được cho, tặng", icon: "gift", color: "pink" },
  { name: "Đầu tư", icon: "invest", color: "teal" },
  { name: "Thu nhập khác", icon: "other", color: "slate" },
];

export async function provisionAccount(tx: Tx, userId: string): Promise<void> {
  await tx.insert(wallets).values(DEFAULT_WALLETS.map((w, i) => ({ ...w, userId, sortOrder: i })));
  await tx.insert(categories).values([
    ...DEFAULT_EXPENSE_CATEGORIES.map((c, i) => ({ ...c, userId, kind: "expense" as const, sortOrder: i })),
    ...DEFAULT_INCOME_CATEGORIES.map((c, i) => ({ ...c, userId, kind: "income" as const, sortOrder: i })),
  ]);
  await tx.insert(userSettings).values({ userId }).onConflictDoNothing();
}

/** The income category tuition payments are booked under (re-created if deleted). */
export async function ensureTuitionCategory(tx: Tx, userId: string): Promise<string> {
  const [existing] = await tx
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.userId, userId), eq(categories.systemKey, "tuition")))
    .limit(1);
  if (existing) return existing.id;
  const [created] = await tx
    .insert(categories)
    .values({ ...TUITION_CATEGORY, userId, kind: "income", sortOrder: 1 })
    .onConflictDoNothing()
    .returning({ id: categories.id });
  if (created) return created.id;
  // A same-named manual category exists: adopt it as the tuition category.
  const [byName] = await tx
    .update(categories)
    .set({ systemKey: "tuition" })
    .where(and(eq(categories.userId, userId), eq(categories.kind, "income"), eq(categories.name, TUITION_CATEGORY.name)))
    .returning({ id: categories.id });
  return byName.id;
}
