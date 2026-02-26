# Local Development

HumanOnly local development keeps governance guarantees visible even in MVP mode:
- Human expression only
- AI-managed operations only
- Human-governed decisions
- Auditability + admin human override

## 1) Install dependencies

```bash
npm install
```

## 2) Configure local auth + role bootstrap

Create `apps/web/.env.local`:

```bash
NEXTAUTH_SECRET=replace-with-long-random-secret
HUMANONLY_ADMIN_HANDLES=chief_admin
HUMANONLY_MODERATOR_HANDLES=queue_mod
HUMANONLY_SEED_FILE=.seed/local-seed.json
```

`HUMANONLY_SEED_FILE` is optional. When set, the in-memory store hydrates from the seed snapshot during app startup.

## 3) Generate deterministic local seed data

```bash
npm run seed
```

Default output: `apps/web/.seed/local-seed.json`

Optional flags:

```bash
npm run seed -- --output .seed/my-demo.json --reference-time 2026-02-20T12:00:00.000Z
```

## 4) Start the app

```bash
npm run dev
```

Open `http://localhost:3000`.

## Seeded demo identities

- `chief_admin` → admin
- `queue_mod` → moderator
- `human_author` → member
- `civic_reader` → member

Use onboarding (`/onboarding`) with:
- matching handle
- any display name
- human attestation = `yes`

## Expected seeded content

- 3 posts
- 3 reports (`open`, `triaged`, `resolved`)

This gives a ready moderation queue + override test surface without manual bootstrapping.
