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
- [ ] Basic UI for create post / feed / report
- [ ] Add smoke tests for core flows

## Completed in this run
- Added a production-grade seed module with governance assertions (`humanExpressionOnly`, `aiManagedOperationsOnly`, `humanGovernedDecisionsOnly`, `auditabilityRequired`, `humanOverrideReservedForAdmins`).
- Added deterministic local fixture generation via `npm run seed` (`apps/web/scripts/seed.ts`).
- Added startup seed hydration via `HUMANONLY_SEED_FILE` with strict validation + fail-fast error handling.
- Added unit tests for seed creation, governance assertion validation, relationship integrity, and store hydration.
- Documented local bootstrap workflow in `docs/LOCAL_DEVELOPMENT.md` and updated README.

## Remaining priorities
1. Build basic monochrome UI flows for create post / feed / report.
2. Add smoke tests for onboarding → post → report → moderation queue + override.
3. Prepare durable persistence migration plan (replace in-memory store + audit stub).

## Risks
- In-memory store remains non-durable between runtime restarts without `HUMANONLY_SEED_FILE`.
- Credentials onboarding is MVP-grade; production needs stronger identity proofing.
- NextAuth beta in use until stable v5 release is adopted.
