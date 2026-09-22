import "server-only";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { isModuleKey, type ModuleKey } from "@/config/modules";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { SESSION_COOKIE, verifySession } from "./session";

export type CurrentUser = {
  id: string;
  username: string;
  displayName: string;
  role: "admin" | "user";
  modules: ModuleKey[];
  mustChangePassword: boolean;
  sessionVersion: number;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The real authorization check. proxy.ts only looks at the cookie signature;
 * this re-reads the account on every request (memoised per request), so a
 * disabled account, a password reset or a module change applies immediately.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const store = await cookies();
  const claims = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!claims || !UUID.test(claims.sub)) return null;

  const [row] = await getDb()
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      role: users.role,
      modules: users.modules,
      status: users.status,
      mustChangePassword: users.mustChangePassword,
      sessionVersion: users.sessionVersion,
    })
    .from(users)
    .where(eq(users.id, claims.sub))
    .limit(1);

  if (!row || row.status !== "active" || row.sessionVersion !== claims.ver) return null;
  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    role: row.role,
    modules: row.modules.filter(isModuleKey),
    mustChangePassword: row.mustChangePassword,
    sessionVersion: row.sessionVersion,
  };
});

export async function requireUser(options: { allowPasswordChange?: boolean } = {}): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword && !options.allowPasswordChange) redirect("/change-password");
  return user;
}

/** A module the account does not have simply does not exist for it. */
export async function requireModule(module: ModuleKey): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.modules.includes(module)) notFound();
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "admin") notFound();
  return user;
}
