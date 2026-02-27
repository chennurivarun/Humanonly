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

## Latest run summary (Sprint 4 — Durable Incident Persistence)
- ✅ Replaced transient incident lifecycle list with durable file-backed snapshot persistence in `apps/web/src/lib/incident/index.ts`.
- ✅ Added configurable incident snapshot path via `HUMANONLY_INCIDENTS_FILE` (default `.data/incidents.json`).
- ✅ Preserved strict human-confirmed declare/resolve semantics and existing validation constraints.
- ✅ Added reload-safety coverage in `apps/web/src/lib/incident/index.test.ts` (incident survives runtime reset by reloading from durable snapshot).
- ✅ Validation clean: typecheck clean, all tests passing, production build successful.

## Next actions
1. ✅ Planned PostgreSQL migration path for multi-instance scale (runbook + schema contract in `docs/SPRINT_4_POSTGRES_MIGRATION_PLAN.md` and `apps/web/db/postgres/schema.sql`).
2. ✅ Implement runtime Postgres storage adapter + backend selector wiring (`HUMANONLY_STORAGE_BACKEND=postgres`).
3. ✅ Persist incident records durably (replace current in-memory lifecycle store).
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
