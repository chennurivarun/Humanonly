# Sprint 6 Storage Backend Benchmark

Generated: 2026-03-04T07:18:53.586Z
Audit mode: sync

## Goal
Compare SQLite and PostgreSQL using the same perf harness profile for governed writes/reads:
- `POST /api/posts`
- `GET /api/feed`
- `POST /api/reports`

## Execution details
- PostgreSQL source: `embedded`
- PostgreSQL URL (redacted): `postgres://humanonly_runner:***@127.0.0.1:51622/humanonly_benchmark`
- Audit mode: `sync` (durability-preserving baseline)

## SQLite vs Postgres (same harness profile)

| Tier | Endpoint | SQLite avg (ms) | Postgres avg (ms) | Avg Δ % | SQLite p95 (ms) | Postgres p95 (ms) | p95 Δ % | SQLite throughput (req/s) | Postgres throughput (req/s) | Throughput Δ % |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| baseline | POST /api/posts | 0.29 | 0.47 | 60.6% | 0.39 | 0.42 | 8.7% | 3406.6 | 2122.4 | -37.7% |
| baseline | GET /api/feed | 0.04 | 0.03 | -21.5% | 0.05 | 0.04 | -8.4% | 22576.2 | 28757.4 | 27.4% |
| baseline | POST /api/reports | 0.24 | 0.29 | 21.1% | 0.31 | 0.33 | 8.3% | 4244.9 | 3505.5 | -17.4% |
| sustained | POST /api/posts | 1.21 | 0.91 | -24.5% | 2.29 | 1.05 | -54.1% | 3297.7 | 4336.4 | 31.5% |
| sustained | GET /api/feed | 0.15 | 0.15 | -1.7% | 0.17 | 0.16 | -4.5% | 26874.7 | 27350.7 | 1.8% |
| sustained | POST /api/reports | 1.28 | 0.92 | -27.9% | 2.26 | 1.05 | -53.7% | 3114.7 | 4297.8 | 38.0% |
| pressure | POST /api/posts | 2.76 | 1.80 | -34.8% | 4.78 | 2.00 | -58.2% | 2876.2 | 4353.0 | 51.3% |
| pressure | GET /api/feed | 0.30 | 0.32 | 3.9% | 0.35 | 0.33 | -5.3% | 26102.6 | 25110.0 | -3.8% |
| pressure | POST /api/reports | 2.99 | 1.81 | -39.5% | 6.10 | 2.08 | -65.9% | 2652.2 | 4323.9 | 63.0% |

## Governance controls (enforced)
- Human expression only: benchmark traffic uses deterministic synthetic fixtures only.
- AI-managed operations: benchmark orchestration + report generation are automated and reproducible.
- Human-governed decisions: production audit-mode changes remain explicit human approvals.
- Auditability: source artifacts are retained and referenced below.
- Human override: operators can force `HUMANONLY_AUDIT_WRITE_MODE=sync` immediately.

## Artifacts
- SQLite JSON: `apps/web/.tmp/perf-backend-compare/sqlite.json`
- Postgres JSON: `apps/web/.tmp/perf-backend-compare/postgres.json`

