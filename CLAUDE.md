@AGENTS.md

# AIO project notes

Personal all-in-one PWA (Vietnamese UI): Finance + Tutoring modules, multi-account with strict per-account data isolation. See README.md for setup/deploy.

## Rules that keep accounts isolated (do not break)
- Tenant tables carry `user_id` + `tenantPolicy()` (RLS) + composite FKs `(user_id, x_id) → parent(user_id, id)` (`src/db/schema`).
- Every tenant query runs inside `withTenant(userId, tx => …)` and still filters `eq(table.userId, userId)`. Pass `tx` down; never nest `withTenant`.
- The app connects as `aio_app` (no BYPASSRLS). `DATABASE_URL_OWNER` (neondb_owner) is only for local migrations/scripts.
- Every Server Action goes through `createAction` / `createFormAction` (`src/lib/action.ts`) with the module guard. Pages use `requireUser` / `requireModule` / `requireAdmin` (`src/lib/auth/dal.ts`); `src/proxy.ts` is only an optimistic redirect.
- Parent links (`/p/[token]`) resolve through `withShareScope` (`src/modules/tutoring/share.ts`); never expose `privateNote` or GPS there.
- Private photos are served only by `/api/photos/[id]` and `/p/[token]/photos/[id]`; never through `next/image`.

## Admin "xem như" and offline
- `CurrentUser.id` is always the account whose data the request touches; `CurrentUser.actor` is the admin behind it when "xem như" is on. Keep using `user.id` for data and `user.actor?.id ?? user.id` for anything about the person clicking.
- Client components import writes from `src/modules/*/offline-actions.ts` (wrapped), never from `actions.ts` directly. Give every new action a `name` in its guard — it is the audit label and the `/api/sync` key.
- New actions that should work offline must be registered in `HANDLERS` in `src/app/api/sync/route.ts`; payloads must be JSON-serialisable.
- Never add a poll, cron or keepalive: Neon free gives ~400 hours of awake time a month and every new connection resets its 5-minute sleep timer.

## Gotchas
- Drizzle leaves columns unqualified in join-free selects: correlated subqueries must spell out the outer table (`"wallets"."id"`).
- Money is whole VND in `bigint({ mode: "number" })`; format with `src/lib/money.ts`.
- Servers run in UTC: use `src/lib/datetime.ts` (Asia/Ho_Chi_Minh, UTC+7) for "today"/month ranges.
- Page transitions: wrap pages in `<Page>` (`src/components/layout/page.tsx`); links opt in with `transitionTypes`.
- Blob uploads must happen outside `withTenant` (a transaction open across a network call is billed as active compute).
- Commands: `npm run lint`, `npm run typecheck`, `npm test` (includes the Neon RLS test), `npm run build`.
