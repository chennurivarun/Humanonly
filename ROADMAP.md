# Roadmap

## Sprint 0 (Now)
- ✅ Repo foundation and governance docs
- ✅ Architecture baseline
- ✅ Contributor onboarding

## Sprint 1 (Week 1 MVP)
- [x] Auth + onboarding
- [x] Post creation + feed
- [x] Report flow + basic moderation queue
- [x] Immutable audit persistence for posts/feed/reports/moderation actions
- [x] Human override control (admin-only)
- [x] Seed script + local dev docs
- [x] Basic UI for create post / feed / report
- [x] Smoke tests for core flows
- [x] Durable governed storage snapshot for identities/posts/reports

## Sprint 2
- [x] Trust scoring v1 baseline (API + rationale model)
- [x] Appeals + action logs
- [x] Admin dashboard metrics
- [x] Role-aware trust + moderation insights surfaces (member trust profile, moderator queue intelligence, trend windows)

## Sprint 3
- [x] Pilot launch readiness runbook (`docs/SPRINT_3_PILOT_RUNBOOK.md`)
- [x] Reliability hardening (durability, observability, incident controls)
- [x] Community contributor expansion (`docs/CONTRIBUTOR_EXPANSION.md`, updated `CONTRIBUTING.md`)

## Sprint 4
- [x] Relational durability migration: SQLite backend with explicit indexes, `StorageAdapter` abstraction, JSON-snapshot compat path (`apps/web/src/lib/storage/`)
- [x] Execute Sprint 3 tabletop incident drill + capture follow-ups (`docs/SPRINT_3_TABLETOP_DRILL_REPORT.md`)
- [x] Strengthen identity assurance beyond MVP attestation (governance commitment + interactive challenge + assurance metadata persistence)
- [x] PostgreSQL migration path (scale-out option from SQLite): runtime `PostgresStorageAdapter`, backend selector wiring (`HUMANONLY_STORAGE_BACKEND=postgres`), and full test coverage delivered (`docs/SPRINT_4_POSTGRES_MIGRATION_PLAN.md`, `apps/web/src/lib/storage/postgres.ts`, `apps/web/src/lib/storage/postgres.test.ts`)
- [x] Durable incident persistence delivered (replaced transient in-memory lifecycle list with file-backed snapshot at `.data/incidents.json`, configurable via `HUMANONLY_INCIDENTS_FILE`)
- [x] Incident packet export delivered (`GET /api/admin/incident/:incidentId/packet`) with timeline, immutable audit references, and governance rationale payload for review/postmortems
- [x] End-to-end CI with real PostgreSQL service container delivered (`.github/workflows/ci.yml`, `apps/web/src/lib/storage/postgres.e2e.test.ts`)
- [x] Pilot runbook alert routing matrix + on-call contact checklist delivered (`docs/SPRINT_3_PILOT_RUNBOOK.md`)
- [x] Automated on-call escalation drill cadence + acknowledgement SLO evidence template delivered (`docs/SPRINT_3_PILOT_RUNBOOK.md`)

## Sprint 5
- [x] Define next features for phase 5
- [x] Implement enhanced moderation tooling (priority queue + SLA view + one-click action handoffs)
- [x] Scale-out performance testing (baseline load profile + bottleneck report)

## Sprint 6
- [x] Plan Sprint 6 write-path optimization follow-through scope
- [x] Add phase-level write-path instrumentation (validation/domain/persist/audit) to post/report writes
- [x] Add async-safe audit write mode toggle (`HUMANONLY_AUDIT_WRITE_MODE=async`) for pressure scenarios
- [x] Run comparative perf profile for `HUMANONLY_AUDIT_WRITE_MODE=sync` vs `async` and document deltas (`docs/SPRINT_6_AUDIT_MODE_BENCHMARK.md`)
- [x] Add SQLite-vs-Postgres benchmark automation script + report template (`npm run perf:storage-backend`, `apps/web/scripts/perf-storage-backend-compare.ts`)
- [x] Execute same harness on PostgreSQL backend and publish SQLite-vs-Postgres deltas (`docs/SPRINT_6_STORAGE_BACKEND_BENCHMARK.md`, embedded live Postgres run)
- [x] Decide default production audit mode policy with rollout/rollback guardrails (default `sync`; production `async` now requires explicit `HUMANONLY_AUDIT_ASYNC_APPROVED=1` + optional approval reference)
- [x] Optimize PostgreSQL persistence path by replacing repeated full-snapshot rewrites with incremental diff-based flushes after baseline sync (`apps/web/src/lib/storage/postgres.ts`)
- [x] Finalize multi-instance Postgres pooling defaults + governed SQLite→Postgres cutover automation (`apps/web/src/lib/storage/postgres-pool.ts`, `apps/web/scripts/postgres-cutover.ts`, `infra/postgres/deployment.md`)
- [x] Validate incremental persistence behavior under managed-production profile (pool policy + network RTT simulation) and publish benchmark evidence (`npm run perf:postgres-managed`, `docs/SPRINT_6_MANAGED_POSTGRES_INCREMENTAL_VALIDATION.md`).
- [x] Add optional periodic full-reconcile job for drift detection in long-lived multi-writer Postgres deployments.
- [x] Integrate governed SQLite→Postgres cutover + incremental validation scripts into production release automation cadence (scheduled plan/apply/verify evidence collection via `.github/workflows/release-governance-cadence.yml`).

## Sprint 7 (Active)
- [x] Re-verify MVP baseline readiness (runnable Next.js app + posts/feed/reports APIs + audit stubs) against current trunk before pre-go-live work.
- [x] Re-validated MVP baseline on 2026-03-05 (autopilot continuation): runnable Next.js app scaffold + posts/feed/reports APIs + audit stubs; local typecheck/test/build all passing.
- [x] Re-validated MVP baseline on 2026-03-05 12:22 IST (autopilot continuation): scaffold + posts/feed/reports APIs + immutable audit stubs confirmed; typecheck/test/build passing.
- [x] Re-validated MVP baseline on 2026-03-05 14:22 IST (autopilot continuation): runnable scaffold + posts/feed/reports APIs + immutable audit stubs confirmed; typecheck/test/build passing.
- [x] Added explicit final go-live governance closeout checklist + owner sign-off matrix (`docs/SPRINT_7_GO_LIVE_CLOSEOUT.md`).
- [x] Added go-live readiness gate automation to release evidence bundles (managed endpoint classification, explicit owner sign-off matrix, deterministic JSON artifact export) (`apps/web/src/lib/release-governance-evidence.ts`, `apps/web/scripts/release-evidence-bundle.ts`, `docs/SPRINT_7_RELEASE_EVIDENCE_BUNDLE.json`).
- [x] Harden managed validation evidence redaction so cadence artifacts never retain raw PostgreSQL credentials (`apps/web/src/lib/postgres-incremental-benchmark.ts`, `apps/web/src/lib/postgres-incremental-benchmark.test.ts`).
- [x] Execute release-governance cadence against designated managed Postgres endpoint and capture evidence links for change sign-off (secret-backed managed-profile run: `#22706417635`, artifact `#5774499356`, no `postgres_url` override).
- [x] Publish release-ticket evidence bundle template with required cadence artifacts and ownership fields (`docs/SPRINT_7_RELEASE_EVIDENCE_BUNDLE.md`, `apps/web/scripts/release-evidence-bundle.ts`).
- [x] Run pilot pre-go-live rehearsal using Sprint 3 runbook checklist with explicit incident/escalation timing capture (`npm run pilot:rehearsal`, `docs/SPRINT_7_PRE_GO_LIVE_REHEARSAL_REPORT.md`).
- [ ] Final go-live governance closeout: rotate `HUMANONLY_MANAGED_POSTGRES_URL` to the final external managed endpoint, rerun cadence, and collect explicit human owner sign-offs on `docs/SPRINT_7_RELEASE_EVIDENCE_BUNDLE.md`.

### Sprint 5 feature definition (2026-03-03)
- ✅ Moderation cockpit v1 delivered: unified queue endpoint/view with queue/risk/age filters, priority ranking, and SLA breach visibility (`/api/moderation/cockpit`, `app/page.tsx`).
- ✅ Workflow acceleration delivered: audited moderation handoff actions (triage, escalate, resolve-note templates) with explicit human confirmation (`/api/moderation/handoff`, immutable audit trail).
- ✅ Capacity confidence milestone delivered: repeatable scale-out perf profile executed for posts/feed/reports APIs with published bottleneck report (`docs/SPRINT_5_SCALE_OUT_PERFORMANCE_REPORT.md`).
