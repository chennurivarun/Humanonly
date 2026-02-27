# Sprint Checklist

## Sprint 1 — MVP Foundation

- [x] Setup runnable Next.js app in `apps/web`
- [x] Implement auth scaffold (Auth.js)
- [x] Create post API endpoint
- [x] Build feed endpoint (latest + cursor pagination)
- [x] Add report endpoint + moderation queue API
- [x] Add immutable audit writer for enforcement-sensitive actions
- [x] Human override control (admin-only)
- [x] Seed script + local dev docs
- [x] Basic UI for create post / feed / report
- [x] Add smoke tests for core flows

## Latest run summary (Sprint 4 — PostgreSQL Runtime Backend)
- ✅ Implemented `PostgresStorageAdapter` (`apps/web/src/lib/storage/postgres.ts`): connection-pooled via `pg.Pool`, idempotent DDL, FK-safe transaction flush (appeals→reports→posts→users delete, users→posts→reports→appeals upsert), `ON CONFLICT (id) DO UPDATE` upsert semantics, JSONB identity-assurance fields.
- ✅ Wired backend selector: `HUMANONLY_STORAGE_BACKEND=postgres` + `HUMANONLY_POSTGRES_URL` → `PostgresStorageAdapter` via `createStorageAdapter()` in `apps/web/src/lib/storage/index.ts`.
- ✅ Coherent async adapter interface: all `StorageAdapter` methods return `Promise<T>`; `SqliteStorageAdapter` and `JsonFileStorageAdapter` wrap synchronous operations with `Promise.resolve()`.
- ✅ Fixed `JsonFileStorageAdapter.loadAll()` early-return bug (returned raw object instead of `Promise<GovernedStore>`).
- ✅ Updated `store.ts`: `initializeStore()` is now properly async with `await` on all adapter calls; `persistStore()` uses fire-and-forget flush (safe for SQLite; documented trade-off for Postgres).
- ✅ Added comprehensive mock-based unit tests for `PostgresStorageAdapter` (`postgres.test.ts`): initialize idempotency, loadAll column mapping, flush transaction ordering, ROLLBACK on error, healthCheck ping.
- ✅ Updated `sqlite.test.ts` and `adapter.test.ts` to use async/await throughout.
- ✅ Governance invariants preserved across all adapters (human expression only, AI-managed ops, human-governed decisions, auditability, admin-only override).
- ✅ Validation clean: typecheck clean, all tests passing, production build successful.

## Next actions
1. ✅ Planned PostgreSQL migration path for multi-instance scale (runbook + schema contract in `docs/SPRINT_4_POSTGRES_MIGRATION_PLAN.md` and `apps/web/db/postgres/schema.sql`).
2. ✅ Implement runtime Postgres storage adapter + backend selector wiring (`HUMANONLY_STORAGE_BACKEND=postgres`).
3. Persist incident records durably (replace current in-memory lifecycle store).
4. Add incident packet export (timeline + audit refs + governance rationale) for runbook follow-up closure.
5. End-to-end CI job with real Postgres service container.

## Sprint 2 progress
- ✅ Added trust scoring v1 baseline domain model (`apps/web/src/lib/trust.ts`) with transparent rationale events.
- ✅ Added trust APIs: `GET /api/trust/me` (self) and `GET /api/trust/:userId` (moderator/admin).
- ✅ Added trust scoring tests for baseline and penalty/reward behavior (`apps/web/src/lib/trust.test.ts`).
- ✅ Added appeals APIs and adjudication flow (`/api/appeals`, `/api/appeals/:appealId/decision`).
- ✅ Added immutable moderation action-log API (`/api/moderation/action-log`).
- ✅ Added admin metrics API + dashboard panel (`/api/admin/metrics`) for reports, appeals, trust distribution, and override rates.
- ✅ Added role-aware moderation insights API + UI surfaces with trend analytics (`/api/moderation/insights`, `src/app/page.tsx`).
