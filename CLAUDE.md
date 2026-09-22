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

## Gotchas
- Drizzle leaves columns unqualified in join-free selects: correlated subqueries must spell out the outer table (`"wallets"."id"`).
- Money is whole VND in `bigint({ mode: "number" })`; format with `src/lib/money.ts`.
- Servers run in UTC: use `src/lib/datetime.ts` (Asia/Ho_Chi_Minh, UTC+7) for "today"/month ranges.
- Page transitions: wrap pages in `<Page>` (`src/components/layout/page.tsx`); links opt in with `transitionTypes`.
- Commands: `npm run lint`, `npm run typecheck`, `npm test` (includes the Neon RLS test), `npm run build`.
