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
- [x] Basic UI for create post / feed / report
- [ ] Add smoke tests for core flows

## Latest run summary
- ✅ Completed milestone: monochrome UI for post creation, feed browsing, and in-feed report submission.
- ✅ Refactored content APIs to use shared domain validators/services for payload parsing, invariants, and feed pagination.
- ✅ Added unit test coverage for content validation + feed pagination behavior.

## Next actions
1. Add smoke tests for onboarding → posting → reporting → moderation queue/override.
2. Lock a durable storage plan for identities, posts/reports, and immutable audit logs.
3. Replace credential-only proofing with stronger identity verification before production launch.
