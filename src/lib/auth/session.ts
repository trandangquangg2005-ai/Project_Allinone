import { jwtVerify, SignJWT } from "jose";

// Shared by proxy.ts and the server; no Node-only or DB imports here.

export const SESSION_COOKIE = "aio_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
/** Re-issue the cookie once it is older than this (sliding session). */
export const SESSION_RENEW_AFTER_SECONDS = 60 * 60 * 24;

/** Admin "xem như tài khoản X". Short-lived on purpose. */
export const VIEW_AS_COOKIE = "aio_view_as";
export const VIEW_AS_MAX_AGE_SECONDS = 60 * 60 * 4;

export type SessionClaims = { sub: string; ver: number; iat: number; exp: number };
/** `adm` = the admin who started it, `sub` = the account being looked at. */
export type ViewAsClaims = { adm: string; sub: string };

function key(): Uint8Array {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) throw new Error("AUTH_SECRET is missing or too short");
  return new TextEncoder().encode(value);
}

export async function signSession(userId: string, sessionVersion: number): Promise<string> {
  return new SignJWT({ ver: sessionVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(key());
}

export async function verifySession(token: string | undefined): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string" || typeof payload.ver !== "number") return null;
    if (typeof payload.iat !== "number" || typeof payload.exp !== "number") return null;
    return { sub: payload.sub, ver: payload.ver, iat: payload.iat, exp: payload.exp };
  } catch {
    return null;
  }
}

export async function signViewAs(adminId: string, targetId: string): Promise<string> {
  return new SignJWT({ adm: adminId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(targetId)
    .setIssuedAt()
    .setExpirationTime(`${VIEW_AS_MAX_AGE_SECONDS}s`)
    .sign(key());
}

export async function verifyViewAs(token: string | undefined): Promise<ViewAsClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string" || typeof payload.adm !== "string") return null;
    return { adm: payload.adm, sub: payload.sub };
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}
