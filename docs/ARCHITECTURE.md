# Architecture v1

## Product Boundary
Human content only; AI supports operations under strict governance.

## Tech Decisions (v1)
- Frontend: Next.js + TypeScript + Tailwind (planned)
- Backend: Next.js API routes (fast prototype path)
- Data durability (current): governed JSON snapshot persistence (`HUMANONLY_DATA_FILE`)
- Data durability (target): PostgreSQL + Prisma for multi-instance scaling
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
- Authorization denials emit immutable audit records.
- Feed/report/post actions emit immutable audit records.
- Admin-only moderation override endpoint requires explicit human confirmation and emits immutable audit records.
- Appeals require human-authored rationale and human-confirmed adjudication by moderator/admin reviewers.
- Moderation action logs are assembled from immutable audit hash-chain records for forensic auditability.
- Admin metrics endpoint (`GET /api/admin/metrics`) summarizes queue throughput, appeal resolution latency, trust distribution, and override rates.
- Role-aware moderation insights endpoint (`GET /api/moderation/insights`) enriches queue entities with trust context, immutable action previews, and 7d/30d trend windows.
- Runtime state (identities, posts, reports, appeals) persists to a governed durable snapshot.

## Non-Negotiables
- Every enforcement action emits an audit record.
- Permanent actions and appeal decisions require human confirmation.
- Emergency override endpoint exists and is tested.
