"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { isModuleKey } from "@/config/modules";
import { getDb, withTenant } from "@/db";
import { users } from "@/db/schema";
import { createAction, UserError } from "@/lib/action";
import { generateTempPassword, hashPassword } from "@/lib/auth/password";
import { provisionAccount } from "@/modules/accounts/provision";
import { createUserSchema, updateUserSchema, userIdSchema, userStatusSchema } from "./schemas";

// Admins manage accounts only. None of these actions read another account's
// finance or tutoring data.
const guard = { admin: true } as const;

function refresh() {
  revalidatePath("/admin");
}

export const createUser = createAction(guard, createUserSchema, async (input) => {
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

export const updateUser = createAction(guard, updateUserSchema, async (input, { user }) => {
  if (input.id === user.id && input.role !== "admin") {
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

export const setUserStatus = createAction(guard, userStatusSchema, async ({ id, status }, { user }) => {
  if (id === user.id) throw new UserError("Bạn không thể tự khóa tài khoản của mình.");
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

export const resetPassword = createAction(guard, userIdSchema, async ({ id }, { user }) => {
  if (id === user.id) throw new UserError("Hãy đổi mật khẩu của bạn trong Cài đặt.");
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
