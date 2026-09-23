"use server";

import { eq, sql } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { createAction, UserError } from "@/lib/action";
import { requireUser } from "@/lib/auth/dal";
import { burnPasswordCheck, hashPassword, verifyPassword } from "@/lib/auth/password";
import { attemptKeys, clearFailures, lockedUntil, recordFailure } from "@/lib/auth/rate-limit";
import { SESSION_COOKIE, sessionCookieOptions, signSession, VIEW_AS_COOKIE } from "@/lib/auth/session";
import { formatTime } from "@/lib/datetime";
import { changePasswordSchema, usernameSchema } from "./schemas";

export type LoginState = { error?: string; username?: string };

function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  // Only same-site paths; "//evil.com" would be protocol-relative.
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}

async function clientIp(): Promise<string | null> {
  const h = await headers();
  return h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

async function setSessionCookie(userId: string, sessionVersion: number) {
  const store = await cookies();
  store.set(SESSION_COOKIE, await signSession(userId, sessionVersion), sessionCookieOptions());
  store.delete(VIEW_AS_COOKIE);
}

export async function login(_previous: LoginState, form: FormData): Promise<LoginState> {
  const rawUsername = String(form.get("username") ?? "");
  const password = String(form.get("password") ?? "");
  const parsed = usernameSchema.safeParse(rawUsername);
  if (!parsed.success || !password) {
    return { error: "Nhập tên đăng nhập và mật khẩu.", username: rawUsername };
  }
  const username = parsed.data;
  const keys = attemptKeys(username, await clientIp());

  const locked = await lockedUntil(keys);
  if (locked) {
    return {
      error: `Bạn đã nhập sai quá nhiều lần. Hãy thử lại sau ${formatTime(locked)}.`,
      username,
    };
  }

  const [user] = await getDb()
    .select({
      id: users.id,
      passwordHash: users.passwordHash,
      status: users.status,
      sessionVersion: users.sessionVersion,
      mustChangePassword: users.mustChangePassword,
    })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  const valid = user ? await verifyPassword(password, user.passwordHash) : (await burnPasswordCheck(password), false);
  if (!user || !valid) {
    await recordFailure(keys);
    return { error: "Tên đăng nhập hoặc mật khẩu không đúng.", username };
  }
  if (user.status !== "active") {
    return { error: "Tài khoản này đang bị khóa. Hãy liên hệ quản trị viên.", username };
  }

  await clearFailures(keys);
  await getDb().update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  await setSessionCookie(user.id, user.sessionVersion);
  redirect(user.mustChangePassword ? "/change-password" : safeNext(form.get("next")));
}

export async function logout() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  store.delete(VIEW_AS_COOKIE);
  redirect("/login");
}

export const changePassword = createAction(
  { allowPasswordChange: true, name: "changePassword" },
  changePasswordSchema,
  async (input, { user }) => {
    const db = getDb();
    const [row] = await db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);
    if (!row || !(await verifyPassword(input.currentPassword, row.passwordHash))) {
      throw new UserError("Mật khẩu hiện tại không đúng.");
    }
    // New version: every other device is signed out; this one gets a fresh cookie.
    const [updated] = await db
      .update(users)
      .set({
        passwordHash: await hashPassword(input.newPassword),
        mustChangePassword: false,
        sessionVersion: sql`${users.sessionVersion} + 1`,
      })
      .where(eq(users.id, user.id))
      .returning({ sessionVersion: users.sessionVersion });
    await setSessionCookie(user.id, updated.sessionVersion);
    return null;
  },
);

/** Sign out every other device; this one stays signed in. */
export async function signOutOtherDevices() {
  const user = await requireUser();
  const [updated] = await getDb()
    .update(users)
    .set({ sessionVersion: sql`${users.sessionVersion} + 1` })
    .where(eq(users.id, user.id))
    .returning({ sessionVersion: users.sessionVersion });
  await setSessionCookie(user.id, updated.sessionVersion);
  return { ok: true as const };
}
