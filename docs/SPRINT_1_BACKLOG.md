# Sprint 1 Backlog

## Epic: Foundation MVP

- [x] Setup Next.js app in `apps/web`
- [x] Implement auth scaffold (Auth.js)
- [x] Create post model + basic API
- [x] Feed endpoint (latest + pagination)
- [x] Report endpoint + moderator queue API
- [x] Audit log table + writer utility (stubbed for Sprint 1)
- [x] Human override control (admin-only)
- [x] Seed script + local dev docs
- [x] Basic UI for create post / feed / report
- [x] Add smoke tests for core flows

## Completed in this run
- Delivered role-aware moderation insights domain service with queue health, trust-enriched entities, immutable action-log previews, and 7d/30d trend windows (`apps/web/src/lib/moderation/insights.ts`).
- Added `GET /api/moderation/insights` (moderator/admin) with strict role guards and immutable audit emission (`apps/web/src/app/api/moderation/insights/route.ts`, `apps/web/src/lib/audit.ts`).
- Expanded monochrome product surfaces:
  - Member trust profile panel (`GET /api/trust/me`)
  - Moderator/admin moderation insights panel (queue snapshots, trust watchlist, trend windows, action chain health)
  (`apps/web/src/app/page.tsx`, `apps/web/src/app/globals.css`).
- Extended moderation audit filtering to include insight reads (`apps/web/src/lib/moderation/action-log.ts`).
- Added automated coverage for moderation insights aggregation (`apps/web/src/lib/moderation/insights.test.ts`).
- Updated roadmap + sprint tracker + docs for milestone closure and Sprint 3 transition (`README.md`, `ROADMAP.md`, `docs/*`).

## Completed in this run (Sprint 3 — Reliability Hardening)
- Delivered reliability domain module with storage health checks, audit hash-chain integrity, and queue latency metrics with threshold-based alerts (`apps/web/src/lib/reliability/index.ts`).
- Delivered incident control module with human-confirmed declare/resolve, validation, and in-memory store (`apps/web/src/lib/incident/index.ts`).
- Shipped `GET /api/admin/reliability` (admin-only, audited) and `GET/POST /api/admin/incident` (admin-only, human-confirmed, audited).
- Added audit action types: `admin.reliability.requested`, `admin.incident.declared`, `admin.incident.resolved`, `admin.incident.listed` (`apps/web/src/lib/audit.ts`).
- Expanded admin UI surfaces: Reliability Status panel and Incident Controls panel (`apps/web/src/app/page.tsx`).
- Fixed `ReliabilityThresholds` type and ensured 66/66 tests pass, typecheck clean, and production build successful.
- Updated roadmap + sprint tracker + docs for Sprint 3 milestone closure.

## Completed in this run (Sprint 4 — Relational Durability Migration)
- Delivered StorageAdapter interface + SqliteStorageAdapter (WAL mode, explicit indexes) + JsonFileStorageAdapter (legacy compat) + createStorageAdapter() factory (apps/web/src/lib/storage/).
- Updated store.ts to use adapter; persistStore() delegates to adapter.flush(db); startup hydrates in-memory arrays from adapter with seed/JSON compat bootstrap path.
- Updated reliability/index.ts to check SQLite DB health (default) or JSON snapshot health; audit log check preserved unchanged.
- Added 20 new tests in sqlite.test.ts and adapter.test.ts; updated reliability tests for both backends.
- All 88 tests pass; typecheck clean; production build successful.

## Completed in this run (Sprint 4 — Identity Assurance Hardening)
- Added enhanced identity assurance module with signed challenge tokens, expiry/min-solve controls, and governance commitment parsing (`apps/web/src/lib/auth/assurance.ts`).
- Added onboarding challenge issuance endpoint (`apps/web/src/app/api/onboarding/challenge/route.ts`) and refreshed monochrome onboarding UX requiring challenge completion (`apps/web/src/app/onboarding/page.tsx`).
- Updated Auth.js credentials onboarding to enforce assurance checks before issuing sessions (`apps/web/src/auth.ts`).
- Persisted assurance metadata across store + adapters + seed snapshots (`apps/web/src/lib/store.ts`, `apps/web/src/lib/storage/sqlite.ts`, `apps/web/src/lib/seed.ts`).
- Added assurance lifecycle, onboarding, seed, and SQLite migration tests (100 passing total).

## Remaining priorities
1. Add severity-to-action alert routing matrix and on-call contact checklist to `docs/SPRINT_3_PILOT_RUNBOOK.md`.
2. Define managed Postgres deployment manifests + connection-pooling defaults for multi-instance production rollout.
3. Add cutover/rollback automation scripts for SQLite -> Postgres migrations.

## Risks
- NextAuth beta runtime remains a dependency risk until stable v5 migration.
- Moderation insights still derive from in-memory joins; large datasets will benefit from direct SQL query paths in the adapter.
- Trend-window analytics are computed from current snapshot state, not historical point-in-time snapshots.
- Postgres CI now validates adapter semantics, but production deployment manifests + managed pooling defaults are still pending.
- Pilot runbook still needs explicit severity-to-action alert routing + on-call contact matrix for faster real-incident escalation.
