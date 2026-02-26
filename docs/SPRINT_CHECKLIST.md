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
- ✅ Delivered appeals workflow with human-confirmed moderator/admin adjudication and immutable audit linkage.
- ✅ Shipped `GET /api/moderation/action-log` to expose moderation timelines from hash-chained audit data.
- ✅ Extended durable governed state + seed contracts to include appeals with legacy snapshot compatibility.
- ✅ Added appeals/action-log tests and expanded smoke flow through appeal adjudication.

## Next actions
1. Build admin dashboard metrics for trust movement, queue throughput, appeal resolution time, and override rates.
2. Surface moderation/action-log/trust insights in role-aware UI components.
3. Plan Sprint 3 pilot launch hardening (observability, reliability, and governance ops).

## Sprint 2 progress
- ✅ Added trust scoring v1 baseline domain model (`apps/web/src/lib/trust.ts`) with transparent rationale events.
- ✅ Added trust APIs: `GET /api/trust/me` (self) and `GET /api/trust/:userId` (moderator/admin).
- ✅ Added trust scoring tests for baseline and penalty/reward behavior (`apps/web/src/lib/trust.test.ts`).
- ✅ Added appeals APIs and adjudication flow (`/api/appeals`, `/api/appeals/:appealId/decision`).
- ✅ Added immutable moderation action-log API (`/api/moderation/action-log`).
