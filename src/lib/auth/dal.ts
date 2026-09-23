import "server-only";
import { eq, inArray } from "drizzle-orm";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { isModuleKey, type ModuleKey } from "@/config/modules";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { SESSION_COOKIE, VIEW_AS_COOKIE, verifySession, verifyViewAs } from "./session";

/** The admin behind the session while "xem như" is on. */
export type Actor = { id: string; username: string; displayName: string };

/**
 * `id` is always the account whose data this request reads and writes, so every
 * query and every `withTenant(user.id, …)` stays correct without knowing about
 * impersonation. When `actor` is set, a different (admin) account is driving.
 */
export type CurrentUser = {
  id: string;
  username: string;
  displayName: string;
  role: "admin" | "user";
  modules: ModuleKey[];
  mustChangePassword: boolean;
  sessionVersion: number;
  actor: Actor | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The real authorization check. proxy.ts only looks at the cookie signature;
 * this re-reads the account on every request (memoised per request), so a
 * disabled account, a password reset or a module change applies immediately.
 */
const columns = {
  id: users.id,
  username: users.username,
  displayName: users.displayName,
  role: users.role,
  modules: users.modules,
  status: users.status,
  mustChangePassword: users.mustChangePassword,
  sessionVersion: users.sessionVersion,
};

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const store = await cookies();
  const claims = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!claims || !UUID.test(claims.sub)) return null;

  const viewAs = await verifyViewAs(store.get(VIEW_AS_COOKIE)?.value);
  // One round trip whether or not "xem như" is on.
  const wants = viewAs && viewAs.adm === claims.sub && viewAs.sub !== claims.sub ? viewAs.sub : null;
  const rows = await getDb()
    .select(columns)
    .from(users)
    .where(wants && UUID.test(wants) ? inArray(users.id, [claims.sub, wants]) : eq(users.id, claims.sub))
    .limit(2);

  const self = rows.find((r) => r.id === claims.sub);
  if (!self || self.status !== "active" || self.sessionVersion !== claims.ver) return null;

  const target = wants && self.role === "admin" ? rows.find((r) => r.id === wants) : undefined;
  if (target && target.status === "active") {
    return {
      id: target.id,
      username: target.username,
      displayName: target.displayName,
      // Stays admin so they can reach /admin and switch back; the data is theirs.
      role: self.role,
      modules: target.modules.filter(isModuleKey),
      mustChangePassword: self.mustChangePassword,
      sessionVersion: self.sessionVersion,
      actor: { id: self.id, username: self.username, displayName: self.displayName },
    };
  }

  return {
    id: self.id,
    username: self.username,
    displayName: self.displayName,
    role: self.role,
    modules: self.modules.filter(isModuleKey),
    mustChangePassword: self.mustChangePassword,
    sessionVersion: self.sessionVersion,
    actor: null,
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
