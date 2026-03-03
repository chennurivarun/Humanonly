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

## Latest run summary (Sprint 4 — Incident Packet + Postgres CI)
- ✅ Added governance-ready incident packet export domain + endpoint (`apps/web/src/lib/incident/packet.ts`, `apps/web/src/app/api/admin/incident/[incidentId]/packet/route.ts`).
- ✅ Packet payload now includes lifecycle timeline, immutable audit references, and governance rationale assertions.
- ✅ Expanded admin monochrome incident controls with one-click packet export (`apps/web/src/app/page.tsx`).
- ✅ Added coverage for packet construction behavior (`apps/web/src/lib/incident/packet.test.ts`).
- ✅ Delivered real Postgres CI validation: service-container workflow + gated e2e adapter test (`.github/workflows/ci.yml`, `apps/web/src/lib/storage/postgres.e2e.test.ts`).
- ✅ Added automated on-call escalation drill cadence with acknowledgement SLO tracking + evidence template (`docs/SPRINT_3_PILOT_RUNBOOK.md`).
- ✅ Validation clean: typecheck clean, all tests passing, production build successful.

## Next actions
1. Build repeatable scale-test harness for `POST /api/posts`, `GET /api/feed`, and `POST /api/reports` with concurrency tiers and deterministic seed fixtures.
2. Execute baseline + stress profiles against SQLite and PostgreSQL backends, capture throughput/latency/error budget deltas, and store evidence artifacts under `docs/`.
3. Publish Sprint 5 bottleneck report with mitigation recommendations and rollout priority.

## Sprint 2 progress
- ✅ Added trust scoring v1 baseline domain model (`apps/web/src/lib/trust.ts`) with transparent rationale events.
- ✅ Added trust APIs: `GET /api/trust/me` (self) and `GET /api/trust/:userId` (moderator/admin).
- ✅ Added trust scoring tests for baseline and penalty/reward behavior (`apps/web/src/lib/trust.test.ts`).
- ✅ Added appeals APIs and adjudication flow (`/api/appeals`, `/api/appeals/:appealId/decision`).
- ✅ Added immutable moderation action-log API (`/api/moderation/action-log`).
- ✅ Added admin metrics API + dashboard panel (`/api/admin/metrics`) for reports, appeals, trust distribution, and override rates.
- ✅ Added role-aware moderation insights API + UI surfaces with trend analytics (`/api/moderation/insights`, `src/app/page.tsx`).

## Latest run summary (Sprint 5 — enhanced moderation tooling)
- ✅ Added a moderation cockpit domain with priority scoring, trust-risk tiering, SLA calculations, and filter support (`apps/web/src/lib/moderation/cockpit.ts`).
- ✅ Added role-gated cockpit API (`GET /api/moderation/cockpit`) with immutable audit logging for filter + SLA observability (`apps/web/src/app/api/moderation/cockpit/route.ts`).
- ✅ Added audited moderation handoff workflow (`POST /api/moderation/handoff`) with explicit human confirmation and template-governed actions (`apps/web/src/lib/moderation/handoff.ts`, `apps/web/src/app/api/moderation/handoff/route.ts`).
- ✅ Expanded monochrome moderator UI with moderation cockpit filters, SLA view, and one-click handoff controls (`apps/web/src/app/page.tsx`).
- ✅ Extended moderation audit coverage to include cockpit reads + handoff events (`apps/web/src/lib/audit.ts`, `apps/web/src/lib/moderation/action-log.ts`).
- ✅ Added automated test coverage for cockpit ranking/SLA logic and handoff validation/state transitions (`apps/web/src/lib/moderation-cockpit.test.ts`, `apps/web/src/lib/moderation-handoff.test.ts`).
- ✅ Validation clean: typecheck passing, tests passing, production build passing.

## Sprint 5 checklist
- [x] Define next features for phase 5 (scoped in `ROADMAP.md`)
- [x] Implement enhanced moderation tooling (priority queue + SLA view + action handoffs)
- [ ] Run scale-out performance testing and publish bottleneck report
