# Architecture v1

## Product Boundary
Human content only; AI supports operations under strict governance.

## Tech Decisions (v1)
- Frontend: Next.js + TypeScript + Tailwind
- Backend: Next.js API routes (fast prototype path)
- DB: PostgreSQL (Prisma)
- Auth: Auth.js (email + OAuth optional)
- Queue: Redis/BullMQ (phase 2)

## Core Services
1. Identity Service (auth + profile + trust baseline)
2. Content Service (posts/comments/reactions)
3. Moderation Service (reports, actions, appeals)
4. Trust Engine (risk signals + confidence scoring)
5. Audit Service (immutable action timeline)

## Non-Negotiables
- Every enforcement action emits an audit record.
- Permanent actions require human confirmation.
- Emergency override endpoint exists and is tested.
