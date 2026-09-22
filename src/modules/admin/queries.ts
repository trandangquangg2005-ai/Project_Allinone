import "server-only";
import { asc, sql } from "drizzle-orm";
import { isModuleKey, type ModuleKey } from "@/config/modules";
import { getDb } from "@/db";
import { users } from "@/db/schema";

export type AccountView = {
  id: string;
  username: string;
  displayName: string;
  role: "admin" | "user";
  modules: ModuleKey[];
  status: "active" | "disabled";
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
};

/** Account metadata only; nothing from any account's own data. */
export async function listAccounts(): Promise<AccountView[]> {
  const rows = await getDb()
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      role: users.role,
      modules: users.modules,
      status: users.status,
      mustChangePassword: users.mustChangePassword,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(sql`${users.status} = 'disabled'`, asc(users.createdAt));
  return rows.map((r) => ({ ...r, modules: r.modules.filter(isModuleKey) }));
}
