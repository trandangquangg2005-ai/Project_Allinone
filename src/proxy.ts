import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_RENEW_AFTER_SECONDS,
  sessionCookieOptions,
  signSession,
  verifySession,
} from "@/lib/auth/session";

// Optimistic gate only: checks the cookie signature and bounces anonymous
// visitors to /login. The real check (account active, session version,
// modules) happens in the DAL next to the data.

const PUBLIC = ["/login"];

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const claims = await verifySession(token);
  const isPublic = PUBLIC.some((path) => pathname === path || pathname.startsWith(`${path}/`));

  if (!claims) {
    // Server Actions answer with their own "session expired" result.
    if (isPublic || request.headers.has("next-action")) return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
    const response = NextResponse.redirect(url);
    if (token) response.cookies.delete(SESSION_COOKIE);
    return response;
  }

  const response = NextResponse.next();
  // Sliding session: Server Components cannot set cookies, so renew here.
  const age = Math.floor(Date.now() / 1000) - claims.iat;
  if (age > SESSION_RENEW_AFTER_SECONDS) {
    response.cookies.set(SESSION_COOKIE, await signSession(claims.sub, claims.ver), sessionCookieOptions());
  }
  return response;
}

export const config = {
  matcher: [
    // Skip assets, parent links (/p/...) and route handlers (they authorise themselves).
    "/((?!_next/static|_next/image|api/|p/|brand/|icons/|favicon\\.ico|icon\\.svg|apple-icon|manifest\\.webmanifest|opengraph-image|robots\\.txt).*)",
  ],
};
