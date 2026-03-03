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
1. Execute the same harness against PostgreSQL (`HUMANONLY_STORAGE_BACKEND=postgres`) and compare with SQLite deltas.
2. Decide default production audit mode based on throughput-vs-durability tradeoff and document rollout/rollback guardrails.
3. Finalize multi-instance connection pooling defaults + cutover automation sequencing for production rollout.

## Latest run summary (Sprint 6 — storage backend benchmark automation)
- ✅ Added one-command backend comparison automation (`npm run perf:storage-backend`) that runs the existing harness against SQLite and PostgreSQL and publishes a single markdown delta report (`apps/web/scripts/perf-storage-backend-compare.ts`).
- ✅ Added Sprint 6 benchmark report scaffold with execution/artifact details (`docs/SPRINT_6_STORAGE_BACKEND_BENCHMARK.md`).
- ⏳ Live PostgreSQL execution still pending a configured `HUMANONLY_POSTGRES_URL` on the current host.

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

## Latest run summary (Sprint 5 — scale-out performance)
- ✅ Added repeatable performance harness for `POST /api/posts`, `GET /api/feed`, and `POST /api/reports` with deterministic seed reset + tiered concurrency (`apps/web/scripts/perf-harness.ts`).
- ✅ Added runnable workspace/app scripts for harness execution (`package.json`, `apps/web/package.json`).
- ✅ Executed baseline/sustained/pressure profiles with zero failures and published metrics + bottleneck analysis (`docs/SPRINT_5_SCALE_OUT_PERFORMANCE_REPORT.md`).
- ✅ Updated roadmap + sprint tracking to mark Sprint 5 scale-out milestone complete.

## Latest run summary (Sprint 6 — write-path optimization kickoff)
- ✅ Added phase-level write-path timings (validation/domain/persist/audit + total) for post/report write APIs (`apps/web/src/lib/write-path.ts`, `apps/web/src/app/api/posts/route.ts`, `apps/web/src/app/api/reports/route.ts`).
- ✅ Refactored content write domain helpers to isolate domain mutation from persistence, enabling explicit persist-phase measurement (`apps/web/src/lib/content.ts`).
- ✅ Added async-safe audit write mode toggle (`HUMANONLY_AUDIT_WRITE_MODE=async`) to decouple request latency from audit fs writes during pressure tests.
- ✅ Updated roadmap + sprint checklist to mark Sprint 6 kickoff complete and track remaining sync-vs-async benchmark work.

## Latest run summary (Sprint 6 — sync vs async audit benchmark)
- ✅ Extended the perf harness with explicit audit-mode execution, JSON export support, and queue-drain correctness for fire-and-forget audit writes (`apps/web/scripts/perf-harness.ts`, `apps/web/src/lib/audit.ts`).
- ✅ Added cross-mode compare automation that runs sync+async harness passes and publishes delta tables as JSON/Markdown artifacts (`apps/web/scripts/perf-audit-mode-compare.ts`, `package.json`, `apps/web/package.json`).
- ✅ Added regression coverage for queued async audit flushing (`apps/web/src/lib/audit.test.ts`).
- ✅ Executed sync-vs-async benchmark under baseline/sustained/pressure load and published reproducible results with governance guardrails (`docs/SPRINT_6_AUDIT_MODE_BENCHMARK.md`).

## Sprint 6 checklist
- [x] Plan Sprint 6 write-path optimization follow-through scope
- [x] Add phase-level write-path instrumentation (validation/domain/persist/audit) to post/report writes
- [x] Add async-safe audit write mode toggle
- [x] Run sustained + pressure benchmark comparing `HUMANONLY_AUDIT_WRITE_MODE=sync` vs `async` and publish deltas
- [x] Add SQLite-vs-Postgres harness comparison automation + report scaffold
- [ ] Execute SQLite-vs-Postgres benchmark with live PostgreSQL and publish validated deltas

## Sprint 5 checklist
- [x] Define next features for phase 5 (scoped in `ROADMAP.md`)
- [x] Implement enhanced moderation tooling (priority queue + SLA view + action handoffs)
- [x] Run scale-out performance testing and publish bottleneck report
