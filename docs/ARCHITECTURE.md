# Architecture v1

## Product Boundary
Human content only; AI supports operations under strict governance.

## Tech Decisions (v1)
- Frontend: Next.js + TypeScript + Tailwind (planned)
- Backend: Next.js API routes (fast prototype path)
- Data durability (current): SQLite via `StorageAdapter` abstraction (`apps/web/src/lib/storage/`); JSON snapshot compat path available via `HUMANONLY_STORAGE_BACKEND=json-snapshot`
- Data durability (target): PostgreSQL adapter (drop-in via `StorageAdapter` interface) for multi-instance scaling
- Auth: Auth.js (credentials scaffold with enhanced assurance: attestation + governance commitment + interactive challenge)
- Queue: Redis/BullMQ (phase 2)

## Core Services
1. Identity Service (Auth.js session + profile + trust baseline)
2. Content Service (posts/comments/reactions)
3. Moderation Service (reports, actions, appeals)
4. Trust Engine (risk signals + confidence scoring)
5. Audit Service (immutable action timeline)

## Current Governance Enforcement
- Human attestation, governance commitment, and an interactive signed challenge are required at onboarding.
- Identity assurance metadata (level + signals + evaluated timestamp) persists with each identity profile.
- Role-aware API guards gate moderation endpoints.
- Authorization denials emit immutable audit records.
- Feed/report/post actions emit immutable audit records.
- Admin-only moderation override endpoint requires explicit human confirmation and emits immutable audit records.
- Appeals require human-authored rationale and human-confirmed adjudication by moderator/admin reviewers.
- Moderation action logs are assembled from immutable audit hash-chain records for forensic auditability.
- Admin metrics endpoint (`GET /api/admin/metrics`) summarizes queue throughput, appeal resolution latency, trust distribution, and override rates.
- Role-aware moderation insights endpoint (`GET /api/moderation/insights`) enriches queue entities with trust context, immutable action previews, and 7d/30d trend windows.
- Runtime state (identities, posts, reports, appeals) persists to a governed durable store via `StorageAdapter` (SQLite default; JSON snapshot legacy path; PostgreSQL runtime adapter available).
- Admin incident packet export (`GET /api/admin/incident/:incidentId/packet`) provides timeline + immutable audit references + governance rationale for escalation/postmortems.

## Non-Negotiables
- Every enforcement action emits an audit record.
- Permanent actions and appeal decisions require human confirmation.
- Emergency override endpoint exists and is tested.
