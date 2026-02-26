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
- [ ] Add smoke tests for core flows

## Completed in this run
- Delivered a production-grade monochrome product surface for post creation, feed browsing, and in-feed reporting (`apps/web/src/app/page.tsx`).
- Added reusable content-domain validation/service module for post/report payloads and feed pagination with author metadata enrichment (`apps/web/src/lib/content.ts`).
- Refactored `posts`, `feed`, and `reports` API routes to use shared domain services and structured validation errors.
- Added unit tests for content validation, report/post invariants, and feed cursor behavior (`apps/web/src/lib/content.test.ts`).
- Expanded global monochrome design system tokens/classes for production-ready forms, cards, notices, and feed layouts (`apps/web/src/app/globals.css`).

## Remaining priorities
1. Add smoke tests for onboarding → post → report → moderation queue + override.
2. Prepare durable persistence migration plan (replace in-memory store + audit stub).
3. Harden identity proofing beyond MVP credentials onboarding.

## Risks
- In-memory store remains non-durable between runtime restarts without `HUMANONLY_SEED_FILE`.
- Auth onboarding is still MVP-grade and requires stronger production identity verification.
- NextAuth beta remains in use until stable v5 migration is completed.
