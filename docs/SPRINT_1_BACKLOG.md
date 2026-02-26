# Sprint 1 Backlog

## Epic: Foundation MVP

- [x] Setup Next.js app in `apps/web`
- [x] Implement auth scaffold (Auth.js)
- [x] Create post model + basic API
- [x] Feed endpoint (latest + pagination)
- [x] Report endpoint + moderator queue API
- [x] Audit log table + writer utility (stubbed for Sprint 1)
- [ ] Human override control (admin-only)
- [ ] Seed script + local dev docs
- [ ] Basic UI for create post / feed / report
- [ ] Add smoke tests for core flows

## Completed in this run
- Added Auth.js credentials-based onboarding with explicit human attestation.
- Added role-aware access control (member/moderator/admin) for sensitive APIs.
- Added authorization-denial audit events for traceability.
- Added monochrome onboarding + identity status surfaces.
- Added onboarding unit tests (credential parsing + role resolution).

## Remaining priorities
1. Admin human override control endpoint + UI affordance (audit-first).
2. Seed script for local demo data and role bootstrap.
3. Smoke tests covering onboarding → post → report → moderation queue.

## Risks
- In-memory store resets on restart; no durable identity/audit persistence yet.
- Credentials onboarding is MVP-grade; production needs stronger identity proofing.
- NextAuth beta in use until stable v5 release is adopted.
