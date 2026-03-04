# Sprint 6 Managed Postgres Incremental Persistence Validation

Generated: 2026-03-04T09:25:38.888Z

## Goal
Validate that PostgreSQL incremental persistence remains effective under managed-production-like pool policy and network latency conditions.

## Execution details
- PostgreSQL source: `embedded`
- PostgreSQL URL (redacted): `postgres://humanonly_runner:***@127.0.0.1:59520/humanonly_incremental`
- Human approval reference: `CHANGE-2026-03-04-MANAGED-VALIDATION`
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
| Incremental flush | 24 | 69.27 | 95.12 | 95.41 | 3.1 | 3.1 | 5.1 |
| Forced full reconcile | 24 | 8506.37 | 8698.26 | 8716.09 | 3.1 | 611.0 | 613.0 |

## Key deltas (incremental relative to forced full reconcile)
- Avg latency delta: -99.2%
- p95 latency delta: -98.9%
- Mutating SQL query delta: -99.5%

## Governance controls (enforced)
- Human expression only: synthetic deterministic payloads only.
- AI-managed operations: benchmark orchestration/report generation automated.
- Human-governed decisions: execution requires explicit `--execute` + `--human-approval-ref`.
- Auditability: JSON + Markdown artifacts generated per run.
- Human override: operators can stop validation and keep SQLite as active backend.

