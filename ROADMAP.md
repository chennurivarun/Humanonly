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
