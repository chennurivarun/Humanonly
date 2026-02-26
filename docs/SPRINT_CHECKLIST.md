# Sprint Checklist

## Sprint 1 — MVP Foundation

- [x] Setup runnable Next.js app in `apps/web`
- [x] Implement auth scaffold (Auth.js)
- [x] Create post API endpoint
- [x] Build feed endpoint (latest + cursor pagination)
- [x] Add report endpoint + moderation queue API
- [x] Add audit writer stubs for enforcement-sensitive actions
- [x] Human override control (admin-only)
- [x] Seed script + local dev docs
- [ ] Basic UI for create post / feed / report
- [ ] Add smoke tests for core flows

## Latest run summary
- ✅ Completed milestone: deterministic seed script + local bootstrap docs.
- ✅ Governance enforcement added to seed fixtures (human-only expression, AI ops boundaries, human-governed decisions, auditability, admin override constraints).
- ✅ Added strict seed validation and startup hydration (`HUMANONLY_SEED_FILE`) with test coverage.

## Next actions
1. Implement monochrome UI for create post, feed browsing, and report submission.
2. Add smoke tests for onboarding → posting → reporting → moderation queue/override.
3. Lock a durable storage plan for identities, posts/reports, and immutable audit logs.
