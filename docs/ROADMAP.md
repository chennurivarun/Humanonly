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
- 🔜 Next highest-priority unfinished milestone: incident packet export (timeline + audit refs + governance rationale) + end-to-end Postgres CI job with real service container
