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

## Remaining priorities
1. Execute Sprint 3 tabletop incident drill using `docs/SPRINT_3_PILOT_RUNBOOK.md`.
2. Replace file-backed durability with indexed relational storage for multi-instance scale.
3. Strengthen identity assurance beyond MVP attestation while preserving human override controls.
4. Community contributor expansion.

## Risks
- File-based durability remains single-node oriented; concurrent writers will require transactional storage.
- NextAuth beta runtime remains a dependency risk until stable v5 migration.
- Moderation insights currently derive from in-memory joins + full audit scans; large datasets will require indexed query paths.
- Trend-window analytics are computed from current snapshot state and timestamped records, not historical point-in-time snapshots.
- Incident store is in-memory only; incidents are lost on server restart (by design for pilot drills; persistent incident log should be added before production scale).
