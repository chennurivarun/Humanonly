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
- Replaced volatile in-memory-only runtime state with governed durable snapshots persisted to `HUMANONLY_DATA_FILE` (`apps/web/src/lib/store.ts`, `apps/web/src/lib/governed-store.ts`).
- Added immutable audit persistence with append-only JSONL records and SHA-256 hash chaining (`apps/web/src/lib/audit.ts`).
- Wired post/report mutations and admin overrides to persist durable state after writes (`apps/web/src/app/api/posts/route.ts`, `apps/web/src/app/api/reports/route.ts`, `apps/web/src/app/api/moderation/override/route.ts`).
- Added production-focused tests for governed snapshot persistence and immutable audit integrity (`apps/web/src/lib/governed-store.test.ts`, `apps/web/src/lib/audit.test.ts`).
- Updated local development and architecture docs for new durability/audit runtime contracts (`docs/LOCAL_DEVELOPMENT.md`, `docs/ARCHITECTURE.md`).

## Remaining priorities
1. Implement Sprint 2 trust scoring v1 with transparent scoring rationale and guardrails.
2. Build appeals workflow + human review action logs over immutable audit data.
3. Ship admin dashboard metrics for queue health, override usage, and trust trend visibility.

## Risks
- File-based durability is suitable for single-node operation but needs DB-backed concurrency controls for horizontal scale.
- Auth onboarding is still MVP-grade and requires stronger production identity verification.
- NextAuth beta remains in use until stable v5 migration is completed.
