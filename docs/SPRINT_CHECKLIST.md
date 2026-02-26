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

## Latest run summary
- ✅ Delivered role-aware moderation insights domain model with queue health, trust-enriched queue entities, immutable action previews, and 7d/30d trend windows.
- ✅ Shipped `GET /api/moderation/insights` (moderator/admin) with immutable audit logging for request traceability.
- ✅ Expanded product UI with member trust profile + moderator/admin insight surfaces under the monochrome design system.
- ✅ Added dedicated moderation insights tests and refreshed roadmap/checklist docs for Sprint 3 handoff.

## Next actions
1. Add observability and reliability hardening tasks (audit-store health checks, queue latency instrumentation).
2. Plan migration path from file-based governed persistence to indexed relational storage.
3. Execute a Sprint 3 tabletop incident drill using `docs/SPRINT_3_PILOT_RUNBOOK.md` and capture follow-ups.

## Sprint 2 progress
- ✅ Added trust scoring v1 baseline domain model (`apps/web/src/lib/trust.ts`) with transparent rationale events.
- ✅ Added trust APIs: `GET /api/trust/me` (self) and `GET /api/trust/:userId` (moderator/admin).
- ✅ Added trust scoring tests for baseline and penalty/reward behavior (`apps/web/src/lib/trust.test.ts`).
- ✅ Added appeals APIs and adjudication flow (`/api/appeals`, `/api/appeals/:appealId/decision`).
- ✅ Added immutable moderation action-log API (`/api/moderation/action-log`).
- ✅ Added admin metrics API + dashboard panel (`/api/admin/metrics`) for reports, appeals, trust distribution, and override rates.
- ✅ Added role-aware moderation insights API + UI surfaces with trend analytics (`/api/moderation/insights`, `src/app/page.tsx`).
