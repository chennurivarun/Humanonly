# Sprint 6 Managed Postgres Incremental Persistence Validation

Generated: 2026-03-05T07:07:59.195Z

## Goal
Validate that PostgreSQL incremental persistence remains effective under managed-production-like pool policy and network latency conditions.

## Execution details
- PostgreSQL source: `cli`
- PostgreSQL URL (redacted): `postgresql://humanonly:***@localhost:5432/humanonly_release`
- Human approval reference: `CHANGE-2026-03-05-MANAGED-SECRET-RUN-RETRY`
- Simulated network latency: `12ms` per SQL round-trip

### Pool policy (resolved)
- Pool size: `20`
- Idle timeout: `10000ms`
- Connection timeout: `5000ms`
- Statement timeout: `5000ms`
- Query timeout: `5000ms`
- Max uses: `0`
- SSL mode (effective): `prefer`
- Production guardrail applied: `no`
- Guardrail rationale: pool defaults resolved

### Dataset profile
- Users: 40
- Posts: 240
- Reports: 240
- Appeals: 80
- Iterations: 24

## Incremental vs full reconcile

| Mode | Iterations | Avg latency (ms) | p95 latency (ms) | Max latency (ms) | Avg changed entities | Avg mutating SQL queries | Avg total SQL queries |
|---|---:|---:|---:|---:|---:|---:|---:|
| Incremental flush | 24 | 66.48 | 90.34 | 90.74 | 3.1 | 3.1 | 5.1 |
| Forced full reconcile | 24 | 7717.73 | 7796.61 | 7821.42 | 3.1 | 611.0 | 613.0 |

## Key deltas (incremental relative to forced full reconcile)
- Avg latency delta: -99.1%
- p95 latency delta: -98.8%
- Mutating SQL query delta: -99.5%

## Governance controls (enforced)
- Human expression only: synthetic deterministic payloads only.
- AI-managed operations: benchmark orchestration/report generation automated.
- Human-governed decisions: execution requires explicit `--execute` + `--human-approval-ref`.
- Auditability: JSON + Markdown artifacts generated per run.
- Human override: operators can stop validation and keep SQLite as active backend.

