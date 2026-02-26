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
- ✅ Audit stubs for post/report/feed/moderation actions
- ✅ Auth.js scaffold with human attestation onboarding + role-aware session guards
- ✅ Admin-only human override control with explicit human confirmation
- ⏳ Next: seed scripts and end-to-end smoke tests

## Local Development
```bash
npm install
npm run dev
```

Then open http://localhost:3000.

### Optional role bootstrap env vars
Create `apps/web/.env.local` if you want moderator/admin sessions during local testing:

```bash
NEXTAUTH_SECRET=replace-with-long-random-secret
HUMANONLY_ADMIN_HANDLES=chief_admin
HUMANONLY_MODERATOR_HANDLES=queue_mod,backup_mod
```

Any onboarded handle matching the allow-lists gets the mapped role.

## Key Endpoints
- `POST /api/posts` — create post (authenticated + human verified)
- `GET /api/feed` — paginated feed read (audit logged)
- `POST /api/reports` — create report (authenticated + human verified)
- `GET /api/reports` — moderation queue (moderator/admin only)
- `POST /api/moderation/override` — admin-only emergency override for report status (audit logged)
- `GET|POST /api/auth/[...nextauth]` — Auth.js handlers

## Contributing
See [CONTRIBUTING.md](./CONTRIBUTING.md).
