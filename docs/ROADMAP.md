# Roadmap (Mirror)

See [../ROADMAP.md](../ROADMAP.md) for the canonical tracker.

## Sprint 1 active milestone status
- ✅ Auth + onboarding completed
- ✅ Human override control (admin-only) delivered
- ✅ Seed script + local dev docs delivered
- ✅ Basic UI for create post / feed / report completed
- ✅ Smoke tests for core onboarding/content/moderation flows delivered
- ✅ Durable governed storage + immutable audit persistence delivered
- ✅ Sprint 2 trust scoring v1 baseline API/model delivered
- ✅ Appeals workflow + immutable moderation action logs delivered
- ✅ Admin dashboard metrics delivered
- ✅ Next highest-priority milestone completed: role-aware trust and moderation insights in expanded UI surfaces
- ✅ Sprint 3 reliability hardening delivered: storage health checks, audit hash-chain integrity, queue latency metrics/alerts, admin reliability API, incident declare/resolve controls, and admin UI surfaces
- ✅ Sprint 3 governance operations runbook delivered (`docs/SPRINT_3_PILOT_RUNBOOK.md`)
- ✅ Sprint 3 community contributor expansion delivered (`docs/CONTRIBUTOR_EXPANSION.md`, `CONTRIBUTING.md`)
- ✅ Sprint 4 relational durability migration delivered: SQLite backend with explicit indexes, `StorageAdapter` abstraction (`apps/web/src/lib/storage/`), JSON-snapshot compat migration path, and updated reliability health checks
- ✅ Sprint 3 tabletop incident drill executed with follow-ups captured (`docs/SPRINT_3_TABLETOP_DRILL_REPORT.md`)
- ✅ Sprint 4 identity assurance hardening delivered: governance commitment + interactive onboarding challenge + persisted assurance metadata (SQLite + JSON snapshot compat)
- ✅ Sprint 4 PostgreSQL runtime adapter delivered: `PostgresStorageAdapter` with connection pooling, FK-safe transactional flush, full mock-based test suite, and coherent async `StorageAdapter` interface across all backends
- ✅ Durable incident persistence delivered: incident lifecycle is now file-backed (`.data/incidents.json`, env override `HUMANONLY_INCIDENTS_FILE`) with reload-safe tests
- ✅ Incident packet export delivered: `GET /api/admin/incident/:incidentId/packet` now returns timeline, immutable audit refs, and governance rationale for review/postmortems
- ✅ End-to-end Postgres CI delivered: GitHub Actions now runs typecheck/test/build with a real PostgreSQL service container and gated e2e adapter test
- ✅ Pilot runbook alerting follow-up delivered: severity-to-action routing matrix + on-call contact checklist added (`docs/SPRINT_3_PILOT_RUNBOOK.md`)
- ✅ Previous highest-priority milestone completed: automate on-call escalation drills (scheduled dry-run cadence + acknowledgement SLO tracking)
- ✅ Next highest-priority milestone completed: enhanced moderation tooling (priority queue + SLA views + audited handoff actions)
- ✅ Next highest-priority milestone completed: scale-out performance testing with published bottleneck report (`docs/SPRINT_5_SCALE_OUT_PERFORMANCE_REPORT.md`)
- ✅ Sprint 6 planning + storage/audit write-path optimization kickoff completed (phase timings + async audit mode toggle for write paths)
- ✅ Next highest-priority milestone completed: sync-vs-async audit write benchmark published with reproducible harness and deltas (`docs/SPRINT_6_AUDIT_MODE_BENCHMARK.md`)
- ✅ Added SQLite-vs-Postgres benchmark automation script and report template (`npm run perf:storage-backend`, `apps/web/scripts/perf-storage-backend-compare.ts`, `docs/SPRINT_6_STORAGE_BACKEND_BENCHMARK.md`)
- ✅ Executed live SQLite-vs-Postgres benchmark run and published validated deltas (`docs/SPRINT_6_STORAGE_BACKEND_BENCHMARK.md`, embedded live PostgreSQL runtime)
- ✅ Locked production audit-mode policy with governance guardrails (default `sync`; production `async` requires explicit `HUMANONLY_AUDIT_ASYNC_APPROVED=1`)
- ✅ PostgreSQL write persistence path optimized: adapter now applies incremental diffs after baseline flush, reducing per-write amplification versus full-snapshot rewrites (`apps/web/src/lib/storage/postgres.ts`).
- ✅ Next highest-priority milestone completed: finalized production Postgres pooling policy + governed SQLite→Postgres cutover automation (policy env parsing, guardrails, deterministic plan/apply/verify reports) (`apps/web/src/lib/storage/postgres-pool.ts`, `apps/web/scripts/postgres-cutover.ts`, `infra/postgres/deployment.md`).
- ✅ Optional periodic Postgres full-reconcile drift guardrail delivered: adapter-level reconcile cadence (`HUMANONLY_POSTGRES_FULL_RECONCILE_EVERY_N_FLUSHES`), explicit reconcile operation, and governed reconcile runner (`apps/web/src/lib/storage/postgres.ts`, `apps/web/scripts/postgres-full-reconcile.ts`).
- ✅ Managed-production profile incremental persistence validation delivered with deterministic evidence artifacts (`npm run perf:postgres-managed`, `docs/SPRINT_6_MANAGED_POSTGRES_INCREMENTAL_VALIDATION.md`).
- 🔜 Next highest-priority unfinished milestone: integrate governed cutover + incremental validation scripts into production release automation cadence (scheduled plan/apply/verify evidence capture).
