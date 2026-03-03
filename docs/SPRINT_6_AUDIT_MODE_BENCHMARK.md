# Sprint 6 Audit Write Mode Benchmark

Date: 2026-03-03  
Scope: Comparative benchmark for `HUMANONLY_AUDIT_WRITE_MODE=sync` vs `async` under baseline/sustained/pressure tiers

## Harness

- Script pair: `apps/web/scripts/perf-harness.ts` + `apps/web/scripts/perf-audit-mode-compare.ts`
- Runtime: Node `v25.6.1` on `darwin`
- Reference seed snapshot: `2026-03-03T00:00:00.000Z`
- Sync DB path: `/Users/varun/.openclaw/workspace/Humanonly/apps/web/.tmp/perf-harness/sync/store.db`
- Async DB path: `/Users/varun/.openclaw/workspace/Humanonly/apps/web/.tmp/perf-harness/async/store.db`
- Sync audit log path: `/Users/varun/.openclaw/workspace/Humanonly/apps/web/.tmp/perf-harness/sync/audit-log.jsonl`
- Async audit log path: `/Users/varun/.openclaw/workspace/Humanonly/apps/web/.tmp/perf-harness/async/audit-log.jsonl`
- Concurrency tiers: baseline (1/60), sustained (4/120), pressure (8/160)

## Results — sync mode

| Tier | Endpoint | Success | Failure | Audit failure | Avg (ms) | P95 (ms) | Throughput (req/s) |
|---|---|---:|---:|---:|---:|---:|---:|
| baseline | POST /api/posts | 60 | 0 | 0 | 0.30 | 0.67 | 3360.3 |
| baseline | GET /api/feed | 60 | 0 | 0 | 0.05 | 0.11 | 19520.7 |
| baseline | POST /api/reports | 60 | 0 | 0 | 0.27 | 0.42 | 3706.5 |
| sustained | POST /api/posts | 120 | 0 | 0 | 1.20 | 2.14 | 3318.8 |
| sustained | GET /api/feed | 120 | 0 | 0 | 0.14 | 0.17 | 27763.9 |
| sustained | POST /api/reports | 120 | 0 | 0 | 1.34 | 2.31 | 2974.2 |
| pressure | POST /api/posts | 160 | 0 | 0 | 2.77 | 4.70 | 2859.6 |
| pressure | GET /api/feed | 160 | 0 | 0 | 0.28 | 0.30 | 28708.1 |
| pressure | POST /api/reports | 160 | 0 | 0 | 3.06 | 4.96 | 2589.2 |

## Results — async mode

| Tier | Endpoint | Success | Failure | Audit failure | Avg (ms) | P95 (ms) | Throughput (req/s) |
|---|---|---:|---:|---:|---:|---:|---:|
| baseline | POST /api/posts | 60 | 0 | 0 | 0.28 | 0.30 | 3625.5 |
| baseline | GET /api/feed | 60 | 0 | 0 | 0.04 | 0.05 | 26764.8 |
| baseline | POST /api/reports | 60 | 0 | 0 | 0.25 | 0.30 | 3945.2 |
| sustained | POST /api/posts | 120 | 0 | 0 | 1.12 | 2.15 | 3540.8 |
| sustained | GET /api/feed | 120 | 0 | 0 | 0.14 | 0.15 | 29077.7 |
| sustained | POST /api/reports | 120 | 0 | 0 | 1.24 | 2.27 | 3187.7 |
| pressure | POST /api/posts | 160 | 0 | 0 | 2.53 | 4.62 | 3125.1 |
| pressure | GET /api/feed | 160 | 0 | 0 | 0.23 | 0.29 | 34020.5 |
| pressure | POST /api/reports | 160 | 0 | 0 | 2.79 | 4.76 | 2821.2 |

## Delta (async vs sync)

Improvement percentages use these semantics:
- Latency improvement > 0 means async is faster (lower latency)
- Throughput gain > 0 means async handles more requests/sec

| Tier | Endpoint | Sync avg (ms) | Async avg (ms) | Avg improvement % | Sync p95 (ms) | Async p95 (ms) | P95 improvement % | Sync throughput | Async throughput | Throughput gain % |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| baseline | POST /api/posts | 0.30 | 0.28 | 7.35 | 0.67 | 0.30 | 54.62 | 3360.3 | 3625.5 | 7.89 |
| baseline | GET /api/feed | 0.05 | 0.04 | 26.84 | 0.11 | 0.05 | 55.69 | 19520.7 | 26764.8 | 37.11 |
| baseline | POST /api/reports | 0.27 | 0.25 | 6.00 | 0.42 | 0.30 | 27.98 | 3706.5 | 3945.2 | 6.44 |
| sustained | POST /api/posts | 1.20 | 1.12 | 6.49 | 2.14 | 2.15 | -0.28 | 3318.8 | 3540.8 | 6.69 |
| sustained | GET /api/feed | 0.14 | 0.14 | 4.48 | 0.17 | 0.15 | 10.77 | 27763.9 | 29077.7 | 4.73 |
| sustained | POST /api/reports | 1.34 | 1.24 | 6.87 | 2.31 | 2.27 | 1.65 | 2974.2 | 3187.7 | 7.18 |
| pressure | POST /api/posts | 2.77 | 2.53 | 8.66 | 4.70 | 4.62 | 1.79 | 2859.6 | 3125.1 | 9.28 |
| pressure | GET /api/feed | 0.28 | 0.23 | 15.82 | 0.30 | 0.29 | 1.97 | 28708.1 | 34020.5 | 18.50 |
| pressure | POST /api/reports | 3.06 | 2.79 | 8.79 | 4.96 | 4.76 | 4.15 | 2589.2 | 2821.2 | 8.96 |

## Observations

1. Write-heavy endpoints (posts/reports) show consistent average-latency and throughput gains in async mode under sustained + pressure load.
2. Tail latency (p95) is directionally improved in several write-path slices but still shows run-to-run variance, so repeat sampling is required before a production policy lock.
3. No audit write failures were observed in either mode during this benchmark run.

## Guardrails

- Keep immutable audit hash-chain requirement unchanged for both modes.
- If async mode is enabled in production, require explicit operator decision + rollback path to sync mode.
- Continue monitoring for audit queue lag/failure signals during pressure windows.

## Exit criteria status

- ✅ Comparative sync-vs-async benchmark executed under sustained pressure.
- ✅ Deltas published with repeatable harness configuration and governance guardrails.
