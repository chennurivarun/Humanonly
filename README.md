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

## Sprint 1 Progress
- ✅ Runnable Next.js app scaffold in `apps/web`
- ✅ MVP APIs: `posts`, `feed`, `reports` + moderation queue
- ✅ Auth.js scaffold with human attestation onboarding + role-aware session guards
- ✅ Admin-only human override control with explicit human confirmation
- ✅ Seed script + deterministic local bootstrap docs
- ✅ Basic monochrome UI for create post/feed/report
- ✅ Smoke tests for core onboarding/content/moderation flows
- ✅ Durable governed storage snapshot (`HUMANONLY_DATA_FILE`) for identities/posts/reports
- ✅ Immutable audit persistence with chained hashes (`HUMANONLY_AUDIT_LOG_FILE`)
- ✅ Sprint 2 trust scoring v1 baseline API/model delivered
- ⏳ Next: appeals/action-log workflow + dashboarding

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
HUMANONLY_DATA_FILE=.data/store.json
HUMANONLY_AUDIT_LOG_FILE=.data/audit-log.jsonl
```

Any onboarded handle matching the allow-lists gets the mapped role.

See [docs/LOCAL_DEVELOPMENT.md](./docs/LOCAL_DEVELOPMENT.md) for full setup and seed options.

## Key Endpoints
- `POST /api/posts` — create post (authenticated + human verified)
- `GET /api/feed` — paginated feed read (audit logged)
- `POST /api/reports` — create report (authenticated + human verified)
- `GET /api/reports` — moderation queue (moderator/admin only)
- `POST /api/moderation/override` — admin-only emergency override for report status (audit logged)
- `GET|POST /api/auth/[...nextauth]` — Auth.js handlers

## Contributing
See [CONTRIBUTING.md](./CONTRIBUTING.md).
