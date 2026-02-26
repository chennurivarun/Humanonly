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
- Delivered full appeals domain workflow with strict validation, eligibility checks, and human-confirmed adjudication (`apps/web/src/lib/moderation/appeals.ts`, `apps/web/src/app/api/appeals/**`).
- Added immutable moderation action-log API derived from chained audit records (`apps/web/src/lib/moderation/action-log.ts`, `apps/web/src/app/api/moderation/action-log/route.ts`).
- Extended governed durable store + seed schema to persist appeals while remaining backward-compatible with legacy snapshots (`apps/web/src/lib/store.ts`, `apps/web/src/lib/seed.ts`, `apps/web/src/lib/governed-store.ts`).
- Expanded automated coverage for appeals and action-log behavior plus updated smoke flow (`apps/web/src/lib/moderation/appeals.test.ts`, `apps/web/src/lib/moderation/action-log.test.ts`, `apps/web/src/lib/smoke/core-flow.test.ts`).
- Updated architecture, roadmap, README, and local-dev docs for Sprint 2 appeals/action-log delivery.

## Remaining priorities
1. Build admin dashboard metrics for queue health, override usage, appeals throughput, and trust trend visibility.
2. Integrate trust and moderation metrics surfaces into product UI (moderator/admin focused).
3. Prepare Sprint 3 pilot readiness hardening (operational reliability + governance monitoring).

## Risks
- File-based durability is suitable for single-node operation but needs DB-backed concurrency controls for horizontal scale.
- Auth onboarding is still MVP-grade and requires stronger production identity verification.
- NextAuth beta remains in use until stable v5 migration is completed.
- Action-log reads currently scan the full audit chain; high-volume environments will need indexed storage for efficient querying.
