# Sprint Checklist

## Sprint 1 — MVP Foundation

- [x] Setup runnable Next.js app in `apps/web`
- [x] Implement auth scaffold (Auth.js)
- [x] Create post API endpoint
- [x] Build feed endpoint (latest + cursor pagination)
- [x] Add report endpoint + moderation queue API
- [x] Add audit writer stubs for enforcement-sensitive actions
- [x] Human override control (admin-only)
- [ ] Seed script + local dev docs
- [ ] Basic UI for create post / feed / report
- [ ] Add smoke tests for core flows

## Latest run summary
- ✅ Completed milestone: Auth + onboarding scaffold with role-aware authorization.
- ✅ Governance coverage improved: explicit human attestation + audit trail for denied access.
- ✅ Monochrome UI baseline now applied to onboarding and identity status surfaces.

## Next actions
1. Add seed tooling + docs for deterministic local demo setup.
2. Add basic UI for create post / feed / report / moderation override.
3. Add smoke tests for the full moderation happy-path.
