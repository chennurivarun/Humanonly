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

## Latest run summary (Sprint 3 — Contributor Expansion)
- ✅ Added contributor expansion guide (`docs/CONTRIBUTOR_EXPANSION.md`) with onboarding paths, review SLA targets, triage standards, and done criteria.
- ✅ Updated `CONTRIBUTING.md` with contribution tracks (docs/tests, product, governance), explicit onboarding links, and enforcement-sensitive change callouts.
- ✅ Marked Sprint 3 community expansion complete in both roadmap trackers (`ROADMAP.md`, `docs/ROADMAP.md`).
- ✅ Sprint checklist now reflects Sprint 3 closure and points to next execution priorities.

## Next actions
1. Execute Sprint 3 tabletop incident drill using `docs/SPRINT_3_PILOT_RUNBOOK.md` and capture follow-ups.
2. Plan migration path from file-based governed persistence to indexed relational storage.
3. Define Sprint 4 scope (pilot feedback loop, persistence migration milestones, contributor issue pipeline).

## Sprint 2 progress
- ✅ Added trust scoring v1 baseline domain model (`apps/web/src/lib/trust.ts`) with transparent rationale events.
- ✅ Added trust APIs: `GET /api/trust/me` (self) and `GET /api/trust/:userId` (moderator/admin).
- ✅ Added trust scoring tests for baseline and penalty/reward behavior (`apps/web/src/lib/trust.test.ts`).
- ✅ Added appeals APIs and adjudication flow (`/api/appeals`, `/api/appeals/:appealId/decision`).
- ✅ Added immutable moderation action-log API (`/api/moderation/action-log`).
- ✅ Added admin metrics API + dashboard panel (`/api/admin/metrics`) for reports, appeals, trust distribution, and override rates.
- ✅ Added role-aware moderation insights API + UI surfaces with trend analytics (`/api/moderation/insights`, `src/app/page.tsx`).
