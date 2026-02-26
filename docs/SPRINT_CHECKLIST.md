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

## Latest run summary (Sprint 3 — Reliability Hardening)
- ✅ Delivered reliability domain module (`apps/web/src/lib/reliability/index.ts`) with storage health checks, audit hash-chain integrity verification, and queue latency metrics with threshold-based alerts.
- ✅ Delivered incident control module (`apps/web/src/lib/incident/index.ts`) with human-confirmed declare/resolve lifecycle, input validation, and in-memory runtime store.
- ✅ Shipped `GET /api/admin/reliability` (admin-only) returning full reliability status with governance assertions and immutable audit trace.
- ✅ Shipped `GET /api/admin/incident` + `POST /api/admin/incident` (admin-only, human-confirmed) with declare/resolve actions and immutable audit emission for all state changes.
- ✅ Expanded admin UI in `apps/web/src/app/page.tsx` with Reliability Status panel (storage, audit chain, queue latency, alerts, governance assertions) and Incident Controls panel (declare/resolve form, active incident list).
- ✅ Fixed `ReliabilityThresholds` type to use mutable `number` fields, eliminating TypeScript literal-type inference errors in tests.
- ✅ All 66 tests passing, typecheck clean, production build successful.

## Next actions
1. Execute Sprint 3 tabletop incident drill using `docs/SPRINT_3_PILOT_RUNBOOK.md` and capture follow-ups.
2. Plan migration path from file-based governed persistence to indexed relational storage.
3. Expand community contributor guidance and onboarding docs for pilot launch.

## Sprint 2 progress
- ✅ Added trust scoring v1 baseline domain model (`apps/web/src/lib/trust.ts`) with transparent rationale events.
- ✅ Added trust APIs: `GET /api/trust/me` (self) and `GET /api/trust/:userId` (moderator/admin).
- ✅ Added trust scoring tests for baseline and penalty/reward behavior (`apps/web/src/lib/trust.test.ts`).
- ✅ Added appeals APIs and adjudication flow (`/api/appeals`, `/api/appeals/:appealId/decision`).
- ✅ Added immutable moderation action-log API (`/api/moderation/action-log`).
- ✅ Added admin metrics API + dashboard panel (`/api/admin/metrics`) for reports, appeals, trust distribution, and override rates.
- ✅ Added role-aware moderation insights API + UI surfaces with trend analytics (`/api/moderation/insights`, `src/app/page.tsx`).
