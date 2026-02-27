# HumanOnly

Open-source social platform for authentic human expression — AI-managed operations, human-governed decisions.

## Mission
HumanOnly restores trust in public discourse by protecting human authorship while constraining AI to operational support.

## Core Principles
- Human expression is non-delegable.
- AI can operate safety/reliability workflows, not identity.
- Moderation must be transparent, appealable, and auditable.
- Human override remains available for emergencies.

## Monorepo Structure
- `apps/web` — landing + product web app
- `packages/core` — shared domain logic (trust, moderation, policy)
- `docs` — manifesto, governance, roadmap, architecture

## Progress Snapshot
- ✅ Runnable Next.js app scaffold in `apps/web`
- ✅ MVP APIs: `posts`, `feed`, `reports` + moderation queue
- ✅ Auth.js scaffold with enhanced onboarding assurance (attestation + governance commitment + interactive challenge) + role-aware session guards
- ✅ Admin-only human override control with explicit human confirmation
- ✅ Seed script + deterministic local bootstrap docs
- ✅ Basic monochrome UI for create post/feed/report
- ✅ Smoke tests for core onboarding/content/moderation flows
- ✅ Durable governed storage snapshot (`HUMANONLY_DATA_FILE`) for identities/posts/reports/appeals
- ✅ Immutable audit persistence with chained hashes (`HUMANONLY_AUDIT_LOG_FILE`)
- ✅ Sprint 2 trust scoring v1 baseline API/model delivered
- ✅ Appeals workflow + immutable moderation action log APIs delivered
- ✅ Admin dashboard metrics API + UI panel for reports, appeals, trust distribution, and override rates
- ✅ Role-aware trust + moderation insights UI for members/moderators/admins with 7d/30d trend windows
- ✅ Sprint 3 pilot governance runbook delivered (`docs/SPRINT_3_PILOT_RUNBOOK.md`)
- ✅ Sprint 3 reliability hardening delivered (storage health checks, audit chain integrity, queue latency alerts, admin incident controls)
- ✅ Sprint 3 community contributor expansion delivered (`docs/CONTRIBUTOR_EXPANSION.md`, `CONTRIBUTING.md`)
- ✅ Relational durability backend delivered: SQLite storage with explicit indexes, StorageAdapter abstraction, and JSON-snapshot compat migration path
- ✅ Sprint 4 identity assurance hardening delivered (signed onboarding challenges, governance commitment capture, assurance metadata persisted to storage)

## Local Development
```bash
npm install
npm run seed
npm run dev
```

Then open http://localhost:3000.

### Local env setup
Create `apps/web/.env.local` for role bootstrap + seed hydration:

```bash
NEXTAUTH_SECRET=replace-with-long-random-secret
HUMANONLY_ADMIN_HANDLES=chief_admin
HUMANONLY_MODERATOR_HANDLES=queue_mod,backup_mod
HUMANONLY_SEED_FILE=.seed/local-seed.json
# Storage backend: "sqlite" (default) or "json-snapshot" (legacy compat)
HUMANONLY_STORAGE_BACKEND=sqlite
HUMANONLY_DB_FILE=.data/store.db
HUMANONLY_AUDIT_LOG_FILE=.data/audit-log.jsonl
# Optional override for signed identity challenge tokens (falls back to NEXTAUTH_SECRET)
HUMANONLY_IDENTITY_ASSURANCE_SECRET=replace-with-long-random-secret
```

Any onboarded handle matching the allow-lists gets the mapped role.

**Storage:** The default backend is SQLite (`HUMANONLY_DB_FILE`). Set `HUMANONLY_STORAGE_BACKEND=json-snapshot` and `HUMANONLY_DATA_FILE=.data/store.json` to use the legacy JSON snapshot backend.

See [docs/LOCAL_DEVELOPMENT.md](./docs/LOCAL_DEVELOPMENT.md) for full setup and seed options.

## Key Endpoints
- `POST /api/posts` — create post (authenticated + human verified)
- `GET /api/feed` — paginated feed read (audit logged)
- `POST /api/reports` — create report (authenticated + human verified)
- `GET /api/reports` — moderation queue (moderator/admin only)
- `POST /api/moderation/override` — admin-only emergency override for report status (audit logged)
- `GET|POST /api/appeals` — create appeals + moderator appeal queue
- `POST /api/appeals/:appealId/decision` — moderator/admin adjudication with explicit human confirmation
- `GET /api/moderation/action-log` — immutable moderation timeline from chained audit records
- `GET /api/moderation/insights` — role-aware moderation/trust queue intelligence + trend windows (moderator/admin)
- `GET /api/admin/reliability` — reliability status (durability + audit-chain integrity + queue latency alerts)
- `GET|POST /api/admin/incident` — admin incident declare/list/resolve controls (human-confirmed + audited)
- `GET /api/onboarding/challenge` — signed onboarding challenge payload for enhanced identity assurance
- `GET|POST /api/auth/[...nextauth]` — Auth.js handlers

## Contributing
See [CONTRIBUTING.md](./CONTRIBUTING.md).
