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
- [x] Add smoke tests for core flows

## Latest run summary
- ✅ Added end-to-end smoke coverage for onboarding → posting → feed → reporting → human override flow.
- ✅ Fixed test discovery to include nested test files (`"src/**/*.test.ts"`) so smoke tests always run in CI/local.
- ✅ Sprint 1 MVP checklist is now fully complete.

## Next actions
1. Lock a durable storage plan for identities, posts/reports, and immutable audit logs.
2. Replace credential-only proofing with stronger identity verification before production launch.
3. Define Sprint 2 trust scoring acceptance criteria and initial test cases.
