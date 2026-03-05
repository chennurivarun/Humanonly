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
# Storage backend selection (default: sqlite)
HUMANONLY_STORAGE_BACKEND=sqlite
HUMANONLY_DB_FILE=.data/store.db
HUMANONLY_AUDIT_LOG_FILE=.data/audit-log.jsonl
HUMANONLY_AUDIT_WRITE_MODE=sync
# Production guardrail: required only if enabling async audit mode in production
HUMANONLY_AUDIT_ASYNC_APPROVED=0
HUMANONLY_AUDIT_ASYNC_APPROVAL_REF=
# Optional override for signed identity challenge tokens (falls back to NEXTAUTH_SECRET)
HUMANONLY_IDENTITY_ASSURANCE_SECRET=replace-with-long-random-secret
# Postgres pooling defaults (used only when HUMANONLY_STORAGE_BACKEND=postgres)
HUMANONLY_POSTGRES_POOL_SIZE=20
HUMANONLY_POSTGRES_IDLE_TIMEOUT_MS=10000
HUMANONLY_POSTGRES_CONNECTION_TIMEOUT_MS=5000
HUMANONLY_POSTGRES_STATEMENT_TIMEOUT_MS=5000
HUMANONLY_POSTGRES_QUERY_TIMEOUT_MS=5000
HUMANONLY_POSTGRES_MAX_USES=0
# Optional drift guardrail: run full reconcile every N flushes (0 disables)
HUMANONLY_POSTGRES_FULL_RECONCILE_EVERY_N_FLUSHES=0
# TLS policy: require|prefer|disable (production disable requires HUMANONLY_POSTGRES_SSL_DISABLE_APPROVED=1)
HUMANONLY_POSTGRES_SSL_MODE=require
HUMANONLY_POSTGRES_SSL_DISABLE_APPROVED=0
```

- `HUMANONLY_STORAGE_BACKEND` — `sqlite` (default), `json-snapshot` (legacy compat), or `postgres` (scale-out runtime backend).
- `HUMANONLY_DB_FILE` — path to the SQLite database (default: `.data/store.db`).
- `HUMANONLY_POSTGRES_URL` — Postgres connection URL used when `HUMANONLY_STORAGE_BACKEND=postgres`.
- `HUMANONLY_POSTGRES_POOL_SIZE` — max pooled connections per app instance (default `20`).
- `HUMANONLY_POSTGRES_IDLE_TIMEOUT_MS` — idle-client timeout before connection recycle (default `10000`).
- `HUMANONLY_POSTGRES_CONNECTION_TIMEOUT_MS` — connection acquisition timeout (default `5000`).
- `HUMANONLY_POSTGRES_STATEMENT_TIMEOUT_MS` — DB statement timeout enforced by pg client (default `5000`).
- `HUMANONLY_POSTGRES_QUERY_TIMEOUT_MS` — query timeout guardrail at client layer (default `5000`).
- `HUMANONLY_POSTGRES_MAX_USES` — max queries per pooled connection before recycle (`0` disables max-uses churn).
- `HUMANONLY_POSTGRES_FULL_RECONCILE_EVERY_N_FLUSHES` — optional full-sync cadence for drift guardrails (`0` disables periodic full reconcile).
- `HUMANONLY_POSTGRES_SSL_MODE` — `require` (default), `prefer`, or `disable`.
- `HUMANONLY_POSTGRES_SSL_DISABLE_APPROVED` — production guardrail override. Required (`1`) if `NODE_ENV=production` and ssl mode is explicitly set to `disable`.
- `HUMANONLY_SEED_FILE` — optional JSON snapshot used for first-run bootstrap.
- `HUMANONLY_DATA_FILE` — path for legacy JSON snapshot backend (only needed when `HUMANONLY_STORAGE_BACKEND=json-snapshot`).
- `HUMANONLY_AUDIT_LOG_FILE` — append-only immutable audit trail with hash chaining (always JSONL).
- `HUMANONLY_AUDIT_WRITE_MODE` — `sync` (default, request waits for audit fs append) or `async` (fire-and-log mode for pressure/perf testing).
- `HUMANONLY_AUDIT_ASYNC_APPROVED` — production guardrail flag. If `NODE_ENV=production` and async mode is requested, this must be `1` or the runtime forces `sync`.
- `HUMANONLY_AUDIT_ASYNC_APPROVAL_REF` — optional human approval/change-ticket reference for async mode governance traceability.
- `HUMANONLY_IDENTITY_ASSURANCE_SECRET` — optional signing secret for onboarding challenge tokens (defaults to `NEXTAUTH_SECRET`).

**New-environment default:** SQLite is created at `HUMANONLY_DB_FILE` on first run. If the DB is empty and `HUMANONLY_SEED_FILE` is configured, seed data is loaded into SQLite automatically.

**Legacy migration path:** If you have an existing `HUMANONLY_DATA_FILE` JSON snapshot and switch to SQLite, set `HUMANONLY_DATA_FILE` in your env — the store will migrate the JSON data into SQLite on the first run with an empty DB.

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

## 5) Run performance benchmarks (Sprint 6)

```bash
# Single mode harness (sync or async)
npm run perf:harness -w apps/web -- --audit-mode=sync

# Comparative benchmark + report artifact
npm run perf:audit-mode -w apps/web -- \
  --markdown-output=docs/SPRINT_6_AUDIT_MODE_BENCHMARK.md \
  --json-output=.tmp/perf-compare/audit-mode.json

# SQLite vs PostgreSQL comparison (auto-starts embedded Postgres if URL not set)
npm run perf:storage-backend -- \
  --markdown-output=docs/SPRINT_6_STORAGE_BACKEND_BENCHMARK.md

# Incremental flush vs forced full-reconcile validation under managed profile
npm run perf:postgres-managed -- \
  --execute \
  --human-approval-ref=CHANGE-2026-03-04 \
  --simulated-latency-ms=12 \
  --markdown-output=docs/SPRINT_6_MANAGED_POSTGRES_INCREMENTAL_VALIDATION.md
```

This executes baseline/sustained/pressure load profiles plus managed-profile incremental validation with deterministic fixtures and reproducible governance evidence artifacts.

## 6) PostgreSQL cutover plan/apply/verify automation

```bash
# Plan only (snapshot SQLite + optional target parity if Postgres URL is configured)
npm run db:cutover:postgres -w apps/web -- --action=plan --output=.tmp/postgres-cutover/plan.json

# Apply SQLite -> Postgres cutover (requires explicit human approval reference)
npm run db:cutover:postgres -w apps/web -- \
  --action=apply \
  --execute \
  --human-approval-ref=CHANGE-2026-03-04 \
  --postgres-url=postgres://humanonly_user:***@managed-host:5432/humanonly_db \
  --output=.tmp/postgres-cutover/apply.json

# Verify parity post-cutover
npm run db:cutover:postgres -w apps/web -- \
  --action=verify \
  --postgres-url=postgres://humanonly_user:***@managed-host:5432/humanonly_db \
  --output=.tmp/postgres-cutover/verify.json
```

The cutover script enforces governance controls:
- **Human-governed decisions:** apply mode requires `--human-approval-ref` + `--execute`.
- **Auditability:** deterministic JSON report is always written.
- **Human override:** operators can abort before apply and keep SQLite as rollback source of truth.

### 7) Build release-ticket evidence bundle

```bash
npm run release:evidence:bundle -w apps/web -- \
  --run-id=123456789 \
  --run-url=https://github.com/chennurivarun/Humanonly/actions/runs/123456789 \
  --target-profile=managed \
  --approval-ref=CHANGE-2026-03-04 \
  --managed-postgres-source=repo-secret \
  --managed-postgres-url=postgres://humanonly_user:***@managed-host:5432/humanonly_db \
  --cutover-plan-json=.tmp/release-cadence/cutover-plan.json \
  --cutover-apply-json=.tmp/release-cadence/cutover-apply.json \
  --cutover-verify-json=.tmp/release-cadence/cutover-verify.json \
  --perf-json=.tmp/release-cadence/perf-postgres-managed.json \
  --output=docs/SPRINT_7_RELEASE_EVIDENCE_BUNDLE.md \
  --output-json=docs/SPRINT_7_RELEASE_EVIDENCE_BUNDLE.json
```

This renders both markdown + JSON release evidence bundles with cadence governance gates, managed-endpoint classification, and owner sign-off records.

Prefer feeding a deterministic sign-off manifest (one JSON chunk with releaseManager/incidentCommander/platformOperator/governanceLead entries) via the new `--signoff-manifest-json` flag. Start from `docs/SPRINT_7_SIGNOFF_MANIFEST_TEMPLATE.json`, copy it to a private working file, then fill in explicit human decisions. The manifest parser enforces required roles, valid `pending|approved|rejected` decisions, ISO timestamps, approval references for approved/rejected states, and optional contact channels/notes; bundler owners and sign-off records derive from those entries, keeping explicit human decisions traceable. CLI `--*-signoff*` flags remain available for ad-hoc updates when a manifest is not used.

Progress: sign-off metadata ingestion is deterministic and audit-ready, and go-live endpoint gates now enforce both external host classification and governed endpoint evidence sources (`repo-secret`/`env`). Workflow input overrides are treated as non-final evidence and keep closeout blocked until the managed secret is rotated.

To record explicit human sign-offs, rerun the same command with signoff flags per role (for example `--release-manager-signoff=approved --release-manager-signoff-ref=CHANGE-2026-03-05-GO-LIVE --release-manager-signoff-at=2026-03-05T10:30:00Z`).

### 7.1) Generate deterministic go-live closeout status + outreach drafts

```bash
npm run go-live:closeout -w apps/web -- \
  --bundle-json=docs/SPRINT_7_RELEASE_EVIDENCE_BUNDLE.json \
  --output=docs/SPRINT_7_GO_LIVE_CLOSEOUT_REPORT.md \
  --output-json=docs/SPRINT_7_GO_LIVE_CLOSEOUT_REPORT.json
```

This generates a governed closeout report with:
- readiness gate status (PASS/FAIL)
- explicit blocker list
- owner sign-off status matrix
- **draft sign-off outreach messages** (draft only; requires explicit human approval before sending externally)

Manifest-driven owners/contact info can feed the outreach drafts too: supply the same `--signoff-manifest-json` file here and the contact channels embedded in each role entry will populate the `pending sign-off outreach` drafts unless a CLI `--*-contact` override is provided.

When final human decision is ready, append explicit decision metadata:

```bash
npm run go-live:closeout -w apps/web -- \
  --bundle-json=docs/SPRINT_7_RELEASE_EVIDENCE_BUNDLE.json \
  --decision=approved \
  --decision-ref=CHANGE-2026-03-05-GO-LIVE \
  --decision-by="Release Board" \
  --decision-at=2026-03-05T11:00:00Z
```

### 7.2) Configure managed cadence secret for workflow runs

```bash
gh secret set HUMANONLY_MANAGED_POSTGRES_URL \
  --repo chennurivarun/Humanonly \
  --body "postgresql://humanonly_user:***@managed-host:5432/humanonly_db"
```

- Keep this URL scoped to release cadence automation only.
- For production launch evidence, point to the final external managed endpoint (not CI localhost/service-container targets).
- Final closeout readiness intentionally fails when cadence endpoint evidence source is `workflow-input`; run managed cadence from governed `repo-secret`/`env` sources for production sign-off.

### 8) Run Sprint 7 pre-go-live rehearsal evidence capture

```bash
npm run pilot:rehearsal -w apps/web -- \
  --execute \
  --human-approval-ref=CHANGE-2026-03-05 \
  --output=docs/SPRINT_7_PRE_GO_LIVE_REHEARSAL_REPORT.md \
  --json-output=.tmp/pre-go-live-rehearsal/report.json
```

This simulates Sev-1/Sev-2 acknowledgement drills + cross-role failover timing, exports incident packet artifacts, and renders a deterministic pre-go-live rehearsal report with governance gate outcomes.

### Optional periodic/full reconcile maintenance run

```bash
npm run db:reconcile:postgres -w apps/web -- \
  --execute \
  --human-approval-ref=CHANGE-2026-03-04 \
  --postgres-url=postgres://humanonly_user:***@managed-host:5432/humanonly_db \
  --output=.tmp/postgres-reconcile/report.json
```

This executes a deterministic full reconcile pass against PostgreSQL and verifies post-reconcile parity + referential integrity, writing a governance evidence report artifact.

## UI + API walkthrough (Sprint 4)

1. Sign in from `/onboarding` using one of the seeded handles, complete human attestation, accept governance commitment, and solve the interactive identity challenge.
2. Create a post from the home-page composer.
3. Browse the feed and use **Report post** on any item.
4. As reporter or reported author, submit an appeal via `POST /api/appeals` with report id + rationale.
5. For any authenticated member, inspect trust rationale in the **Trust profile** panel (`GET /api/trust/me`).
6. For moderator/admin handles, inspect role-aware queue/trend context from **Moderation insights** (`GET /api/moderation/insights`).
7. Adjudicate appeal decisions with explicit human confirmation using `POST /api/appeals/:appealId/decision`.
8. Inspect immutable moderation timeline at `GET /api/moderation/action-log`.
9. As an admin, inspect reliability posture from `GET /api/admin/reliability` (storage health, audit hash-chain integrity, queue latency alerts).
10. As an admin, run incident drill controls using `GET|POST /api/admin/incident` with explicit `humanConfirmed: true` for declare/resolve actions.
11. Export a governance incident packet via `GET /api/admin/incident/:incidentId/packet` and archive it with the postmortem notes.

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
- governance commitment checkbox enabled
- challenge response matching the displayed phrase

## Expected seeded content

- 3 posts
- 3 reports (`open`, `triaged`, `resolved`)
- 1 open appeal linked to a triaged report

This gives a ready moderation queue + override + appeal adjudication test surface without manual bootstrapping.
