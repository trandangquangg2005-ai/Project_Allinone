"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { isModuleKey } from "@/config/modules";
import { getDb, withTenant } from "@/db";
import { users } from "@/db/schema";
import { createAction, UserError } from "@/lib/action";
import { generateTempPassword, hashPassword } from "@/lib/auth/password";
import {
  sessionCookieOptions,
  signViewAs,
  VIEW_AS_COOKIE,
  VIEW_AS_MAX_AGE_SECONDS,
} from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import { provisionAccount } from "@/modules/accounts/provision";
import { createUserSchema, updateUserSchema, userIdSchema, userStatusSchema } from "./schemas";

// Account management, plus "xem như" — the only way an admin reaches another
// account's data, and every write made there is logged.
const guard = { admin: true } as const;

// While "xem như" is on, `user.id` is the account being looked at — these checks
// must always be about the admin who is actually clicking.
function selfId(user: { id: string; actor: { id: string } | null }) {
  return user.actor?.id ?? user.id;
}

function refresh() {
  revalidatePath("/admin");
}

export const createUser = createAction({ ...guard, name: "createUser" }, createUserSchema, async (input) => {
  const tempPassword = generateTempPassword();
  const [created] = await getDb()
    .insert(users)
    .values({
      username: input.username,
      displayName: input.displayName,
      role: input.role,
      modules: input.modules.filter(isModuleKey),
      passwordHash: await hashPassword(tempPassword),
      mustChangePassword: true,
    })
    .returning({ id: users.id });
  // Default wallets and categories live in the new account's own partition.
  await withTenant(created.id, (tx) => provisionAccount(tx, created.id));
  refresh();
  return { username: input.username, tempPassword };
});

export const updateUser = createAction({ ...guard, name: "updateUser" }, updateUserSchema, async (input, { user }) => {
  if (input.id === selfId(user) && input.role !== "admin") {
    throw new UserError("Bạn không thể tự bỏ quyền quản trị của chính mình.");
  }
  const updated = await getDb()
    .update(users)
    .set({ displayName: input.displayName, role: input.role, modules: input.modules.filter(isModuleKey) })
    .where(eq(users.id, input.id))
    .returning({ id: users.id });
  if (!updated.length) throw new UserError("Không tìm thấy tài khoản.");
  refresh();
  return null;
});

export const setUserStatus = createAction({ ...guard, name: "setUserStatus" }, userStatusSchema, async ({ id, status }, { user }) => {
  if (id === selfId(user)) throw new UserError("Bạn không thể tự khóa tài khoản của mình.");
  const updated = await getDb()
    .update(users)
    .set({
      status,
      // Locking signs the account out everywhere immediately.
      ...(status === "disabled" ? { sessionVersion: sql`${users.sessionVersion} + 1` } : {}),
    })
    .where(eq(users.id, id))
    .returning({ id: users.id });
  if (!updated.length) throw new UserError("Không tìm thấy tài khoản.");
  refresh();
  return null;
});

export const resetPassword = createAction({ ...guard, name: "resetPassword" }, userIdSchema, async ({ id }, { user }) => {
  if (id === selfId(user)) throw new UserError("Hãy đổi mật khẩu của bạn trong Cài đặt.");
  const tempPassword = generateTempPassword();
  const [updated] = await getDb()
    .update(users)
    .set({
      passwordHash: await hashPassword(tempPassword),
      mustChangePassword: true,
      sessionVersion: sql`${users.sessionVersion} + 1`,
    })
    .where(eq(users.id, id))
    .returning({ username: users.username });
  if (!updated) throw new UserError("Không tìm thấy tài khoản.");
  refresh();
  return { username: updated.username, tempPassword };
});

/**
 * Opens another account: the session stays the admin's, but every query from
 * now on runs with that account's id, so RLS shows exactly what they see.
 * Lasts 4 hours, and each write lands in the audit log.
 */
export const startViewAs = createAction({ ...guard, name: "startViewAs" }, userIdSchema, async ({ id }, { user }) => {
  const actorId = selfId(user);
  if (id === actorId) throw new UserError("Đây là tài khoản của bạn.");
  const [target] = await getDb()
    .select({ id: users.id, username: users.username, displayName: users.displayName, status: users.status })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  if (!target) throw new UserError("Không tìm thấy tài khoản.");
  if (target.status !== "active") throw new UserError("Tài khoản đang bị khóa. Hãy mở khóa trước.");

  const store = await cookies();
  store.set(VIEW_AS_COOKIE, await signViewAs(actorId, target.id), {
    ...sessionCookieOptions(),
    maxAge: VIEW_AS_MAX_AGE_SECONDS,
  });
  await recordAudit({ actorId, targetId: target.id, action: "startViewAs", detail: { username: target.username } });
  revalidatePath("/", "layout");
  return { username: target.username, displayName: target.displayName };
});

export const stopViewAs = createAction({ ...guard, name: "stopViewAs" }, z.object({}), async () => {
  (await cookies()).delete(VIEW_AS_COOKIE);
  revalidatePath("/", "layout");
  return null;
});
