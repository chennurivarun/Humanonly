# Sprint 6 Storage Backend Benchmark

Generated: 2026-03-03T16:46:04.053Z
Audit mode: sync

## Goal
Compare SQLite and PostgreSQL using the same perf harness profile for governed writes/reads:
- `POST /api/posts`
- `GET /api/feed`
- `POST /api/reports`

## Execution details
- PostgreSQL source: `embedded`
- PostgreSQL URL (redacted): `postgres://humanonly_runner:***@127.0.0.1:52343/humanonly_benchmark`
- Audit mode: `sync` (durability-preserving baseline)

## SQLite vs Postgres (same harness profile)

| Tier | Endpoint | SQLite avg (ms) | Postgres avg (ms) | Avg Δ % | SQLite p95 (ms) | Postgres p95 (ms) | p95 Δ % | SQLite throughput (req/s) | Postgres throughput (req/s) | Throughput Δ % |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| baseline | POST /api/posts | 0.32 | 2.47 | 662.2% | 0.32 | 3.30 | 928.1% | 3075.9 | 404.2 | -86.9% |
| baseline | GET /api/feed | 0.04 | 0.04 | 9.6% | 0.06 | 0.04 | -30.0% | 27064.6 | 24686.7 | -8.8% |
| baseline | POST /api/reports | 0.25 | 2.22 | 782.9% | 0.34 | 3.33 | 888.1% | 3983.2 | 451.3 | -88.7% |
| sustained | POST /api/posts | 1.24 | 12.47 | 903.7% | 2.37 | 20.40 | 759.7% | 3199.9 | 314.1 | -90.2% |
| sustained | GET /api/feed | 0.11 | 0.13 | 16.3% | 0.15 | 0.17 | 14.5% | 35292.4 | 30275.6 | -14.2% |
| sustained | POST /api/reports | 1.31 | 12.99 | 889.2% | 2.27 | 21.74 | 858.0% | 3021.2 | 301.3 | -90.0% |
| pressure | POST /api/posts | 2.87 | 28.93 | 909.4% | 4.91 | 50.52 | 929.1% | 2765.8 | 265.8 | -90.4% |
| pressure | GET /api/feed | 0.28 | 0.26 | -6.9% | 0.34 | 0.33 | -2.5% | 28081.9 | 29977.0 | 6.7% |
| pressure | POST /api/reports | 3.11 | 31.80 | 922.7% | 5.57 | 57.25 | 928.8% | 2550.2 | 241.9 | -90.5% |

## Observations
1. Under durability-preserving sync audit mode, PostgreSQL is substantially slower for write-heavy endpoints in this harness profile because each write currently triggers full snapshot flush semantics.
2. Feed reads remain near-parity between SQLite and PostgreSQL, indicating the bottleneck is write persistence strategy rather than read-path query performance.
3. The live run successfully validated reproducible artifact generation for both backends using a local embedded PostgreSQL runtime.

## Production audit mode policy decision
- **Default remains `sync`** for production durability and governance safety.
- **Production `async` requires explicit human approval** via `HUMANONLY_AUDIT_ASYNC_APPROVED=1` (with optional `HUMANONLY_AUDIT_ASYNC_APPROVAL_REF`).
- **Rollback path:** force `HUMANONLY_AUDIT_WRITE_MODE=sync` immediately.

## Governance controls (enforced)
- Human expression only: benchmark traffic uses deterministic synthetic fixtures only.
- AI-managed operations: benchmark orchestration + report generation are automated and reproducible.
- Human-governed decisions: production audit-mode changes remain explicit human approvals.
- Auditability: source artifacts are retained and referenced below.
- Human override: operators can force `HUMANONLY_AUDIT_WRITE_MODE=sync` immediately.

## Artifacts
- SQLite JSON: `apps/web/.tmp/perf-backend-compare/sqlite.json`
- Postgres JSON: `apps/web/.tmp/perf-backend-compare/postgres.json`

