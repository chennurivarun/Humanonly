# Sprint Checklist

## Sprint 1 — MVP Foundation

- [x] Setup runnable Next.js app in `apps/web`
- [x] Implement auth scaffold (Auth.js)
- [x] Create post API endpoint
- [x] Build feed endpoint (latest + cursor pagination)
- [x] Add report endpoint + moderation queue API
- [x] Add immutable audit writer for enforcement-sensitive actions
- [x] Human override control (admin-only)
- [x] Seed script + local dev docs
- [x] Basic UI for create post / feed / report
- [x] Add smoke tests for core flows

## Latest run summary (Sprint 4 — Identity Assurance Hardening)
- ✅ Added hardened identity assurance domain module (`apps/web/src/lib/auth/assurance.ts`) with signed onboarding challenge tokens, expiry + minimum solve-time checks, governance commitment parsing, and deterministic assurance profile output.
- ✅ Added onboarding challenge API (`GET /api/onboarding/challenge`) with no-store semantics for interactive onboarding verification.
- ✅ Upgraded onboarding UX (`src/app/onboarding/page.tsx`) with governance commitment consent, interactive challenge response input, and refreshable challenge handling.
- ✅ Updated Auth.js onboarding flow (`src/auth.ts`) to require enhanced assurance evidence before session creation and to persist assurance metadata in session/JWT + sign-in audit metadata.
- ✅ Extended identity persistence model (`src/lib/store.ts`, `src/lib/storage/sqlite.ts`, `src/lib/seed.ts`) to carry `identityAssuranceLevel`, `identityAssuranceSignals`, and `identityAssuranceEvaluatedAt` with SQLite legacy-column migration and JSON snapshot compatibility.
- ✅ Added comprehensive automated coverage for assurance lifecycle + onboarding defaults + persistence migrations (`assurance.test.ts`, `onboarding.test.ts`, `sqlite.test.ts`, `seed.test.ts`).
- ✅ Validation clean: 100/100 tests passing, typecheck clean, production build successful.

## Next actions
1. Plan PostgreSQL migration path for multi-instance scale (SQLite → Postgres adapter swap).
2. Persist incident records durably (replace current in-memory lifecycle store).
3. Add incident packet export (timeline + audit refs + governance rationale) for runbook follow-up closure.

## Sprint 2 progress
- ✅ Added trust scoring v1 baseline domain model (`apps/web/src/lib/trust.ts`) with transparent rationale events.
- ✅ Added trust APIs: `GET /api/trust/me` (self) and `GET /api/trust/:userId` (moderator/admin).
- ✅ Added trust scoring tests for baseline and penalty/reward behavior (`apps/web/src/lib/trust.test.ts`).
- ✅ Added appeals APIs and adjudication flow (`/api/appeals`, `/api/appeals/:appealId/decision`).
- ✅ Added immutable moderation action-log API (`/api/moderation/action-log`).
- ✅ Added admin metrics API + dashboard panel (`/api/admin/metrics`) for reports, appeals, trust distribution, and override rates.
- ✅ Added role-aware moderation insights API + UI surfaces with trend analytics (`/api/moderation/insights`, `src/app/page.tsx`).
