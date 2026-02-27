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

## Latest run summary (Sprint 4 — Relational Durability Migration)
- ✅ Delivered `StorageAdapter` interface (`apps/web/src/lib/storage/adapter.ts`) decoupling domain from storage backend.
- ✅ Delivered `SqliteStorageAdapter` (`apps/web/src/lib/storage/sqlite.ts`) with explicit indexes, WAL mode, transactional flush, and file-level health check.
- ✅ Delivered `JsonFileStorageAdapter` (`apps/web/src/lib/storage/json-file.ts`) as legacy compat backend wrapping existing governed-store persistence.
- ✅ Added `createStorageAdapter()` factory; SQLite is the default backend (configurable via `HUMANONLY_STORAGE_BACKEND`).
- ✅ Updated `store.ts` to use adapter; startup hydrates from adapter with seed/JSON compat bootstrap fallback.
- ✅ Updated `reliability/index.ts` to check SQLite DB health (default) or JSON snapshot health (json-snapshot backend); audit log check preserved.
- ✅ Added 20 focused new tests; all 88 tests pass; typecheck clean; production build successful.
- ✅ Updated docs: README, ROADMAP, LOCAL_DEVELOPMENT, SPRINT_CHECKLIST, SPRINT_1_BACKLOG.
- ✅ Executed Sprint 3 tabletop incident drill and captured actionable follow-ups (`docs/SPRINT_3_TABLETOP_DRILL_REPORT.md`).

## Next actions
1. Strengthen identity assurance beyond MVP attestation while preserving human override controls.
2. Plan PostgreSQL migration path for multi-instance scale (SQLite → Postgres adapter swap).
3. Persist incident records durably (replace current in-memory lifecycle store).

## Sprint 2 progress
- ✅ Added trust scoring v1 baseline domain model (`apps/web/src/lib/trust.ts`) with transparent rationale events.
- ✅ Added trust APIs: `GET /api/trust/me` (self) and `GET /api/trust/:userId` (moderator/admin).
- ✅ Added trust scoring tests for baseline and penalty/reward behavior (`apps/web/src/lib/trust.test.ts`).
- ✅ Added appeals APIs and adjudication flow (`/api/appeals`, `/api/appeals/:appealId/decision`).
- ✅ Added immutable moderation action-log API (`/api/moderation/action-log`).
- ✅ Added admin metrics API + dashboard panel (`/api/admin/metrics`) for reports, appeals, trust distribution, and override rates.
- ✅ Added role-aware moderation insights API + UI surfaces with trend analytics (`/api/moderation/insights`, `src/app/page.tsx`).
