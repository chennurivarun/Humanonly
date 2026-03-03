# Sprint 5 Scale-Out Performance Report

Date: 2026-03-03  
Scope: `POST /api/posts`, `GET /api/feed`, `POST /api/reports` (with audit stubs enabled)

## Harness

- Script: `apps/web/scripts/perf-harness.ts`
- Command: `npm run perf:harness`
- Runtime: Node `v25.6.1` on macOS (darwin)
- Storage path used by harness: `apps/web/.tmp/perf-harness/store.db`
- Audit log path used by harness: `apps/web/.tmp/perf-harness/audit-log.jsonl`
- Dataset reset: deterministic seed snapshot (`2026-03-03T00:00:00.000Z`) before each endpoint+tier run

## Concurrency tiers

- baseline: concurrency 1, 60 requests
- sustained: concurrency 4, 120 requests
- pressure: concurrency 8, 160 requests

## Results

| Tier | Endpoint | Success | Failure | Avg (ms) | P95 (ms) | Throughput (req/s) |
|---|---|---:|---:|---:|---:|---:|
| baseline | POST /api/posts | 60 | 0 | 0.35 | 0.75 | 2867.2 |
| baseline | GET /api/feed | 60 | 0 | 0.04 | 0.12 | 22872.0 |
| baseline | POST /api/reports | 60 | 0 | 0.34 | 0.98 | 2968.6 |
| sustained | POST /api/posts | 120 | 0 | 1.50 | 2.85 | 2649.8 |
| sustained | GET /api/feed | 120 | 0 | 0.15 | 0.19 | 26966.3 |
| sustained | POST /api/reports | 120 | 0 | 1.78 | 2.91 | 2238.2 |
| pressure | POST /api/posts | 160 | 0 | 4.56 | 9.36 | 1740.7 |
| pressure | GET /api/feed | 160 | 0 | 0.47 | 0.95 | 16824.7 |
| pressure | POST /api/reports | 160 | 0 | 6.81 | 14.01 | 1159.0 |

## Bottlenecks observed

1. **Write-heavy endpoints degrade fastest under pressure** (`POST /api/reports` and `POST /api/posts`).
2. **Audit + persistence coupling dominates tail latency** at concurrency 8 (p95 up to `14.01 ms` on reports).
3. **Read path remains stable** (`GET /api/feed` stayed sub-1ms p95 even at pressure tier).

## Recommendations

1. Add batched or asynchronous audit flush strategy for high-concurrency write paths.
2. Introduce endpoint-level timing telemetry split by `validation`, `domain mutation`, `persist`, and `audit` phases.
3. Re-run same harness on PostgreSQL backend (`HUMANONLY_STORAGE_BACKEND=postgres`) and compare deltas before Sprint 6 scaling decisions.

## Exit criteria status

- ✅ Repeatable scale-test harness implemented.
- ✅ Baseline + pressure profiles executed with deterministic fixtures.
- ✅ Bottleneck report published with mitigations.
