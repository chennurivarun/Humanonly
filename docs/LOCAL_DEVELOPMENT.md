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
HUMANONLY_DATA_FILE=.data/store.json
HUMANONLY_AUDIT_LOG_FILE=.data/audit-log.jsonl
```

- `HUMANONLY_SEED_FILE` is optional and used for first-run bootstrap.
- `HUMANONLY_DATA_FILE` is the durable governed snapshot for identities/posts/reports/appeals.
- `HUMANONLY_AUDIT_LOG_FILE` is an append-only immutable audit trail with hash chaining.

If `HUMANONLY_DATA_FILE` already exists, it takes precedence over seed bootstrap data.

## 3) Generate deterministic local seed data

```bash
npm run seed
```

Default output: `apps/web/.seed/local-seed.json`

Optional flags:

```bash
npm run seed -w apps/web -- --output .seed/my-demo.json --reference-time 2026-02-20T12:00:00.000Z
```

## 4) Start the app

```bash
npm run dev
```

Open `http://localhost:3000`.

## UI + API walkthrough (Sprint 2)

1. Sign in from `/onboarding` using one of the seeded handles.
2. Create a post from the home-page composer.
3. Browse the feed and use **Report post** on any item.
4. As reporter or reported author, submit an appeal via `POST /api/appeals` with report id + rationale.
5. For any authenticated member, inspect trust rationale in the **Trust profile** panel (`GET /api/trust/me`).
6. For moderator/admin handles, inspect role-aware queue/trend context from **Moderation insights** (`GET /api/moderation/insights`).
7. Adjudicate appeal decisions with explicit human confirmation using `POST /api/appeals/:appealId/decision`.
8. Inspect immutable moderation timeline at `GET /api/moderation/action-log`.

All actions emit immutable audit records to `HUMANONLY_AUDIT_LOG_FILE` (JSONL hash chain).

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
- 1 open appeal linked to a triaged report

This gives a ready moderation queue + override + appeal adjudication test surface without manual bootstrapping.
