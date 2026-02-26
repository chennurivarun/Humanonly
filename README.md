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

## Sprint 0 Goals
- Foundation docs and governance
- Contributor-ready repository setup
- Week-1 MVP architecture decisions

## Sprint 1 Progress
- ✅ Runnable Next.js app scaffold in `apps/web`
- ✅ MVP APIs: `posts`, `feed`, `reports` + moderation queue
- ✅ Audit stubs for post/report/feed/moderation actions
- ⏳ Next: auth scaffold + human override controls

## Local Development
```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Contributing
See [CONTRIBUTING.md](./CONTRIBUTING.md).
