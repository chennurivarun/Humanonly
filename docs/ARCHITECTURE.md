# Architecture v1

## Product Boundary
Human content only; AI supports operations under strict governance.

## Tech Decisions (v1)
- Frontend: Next.js + TypeScript + Tailwind (planned)
- Backend: Next.js API routes (fast prototype path)
- DB: PostgreSQL (Prisma planned, currently in-memory)
- Auth: Auth.js (credentials scaffold with human attestation)
- Queue: Redis/BullMQ (phase 2)

## Core Services
1. Identity Service (Auth.js session + profile + trust baseline)
2. Content Service (posts/comments/reactions)
3. Moderation Service (reports, actions, appeals)
4. Trust Engine (risk signals + confidence scoring)
5. Audit Service (immutable action timeline)

## Current Governance Enforcement
- Human attestation is required at onboarding.
- Role-aware API guards gate moderation endpoints.
- Authorization denials emit audit records.
- Feed/report/post actions emit audit stub records.
- Admin-only moderation override endpoint requires explicit human confirmation and emits audit records.

## Non-Negotiables
- Every enforcement action emits an audit record.
- Permanent actions require human confirmation.
- Emergency override endpoint exists and is tested.
