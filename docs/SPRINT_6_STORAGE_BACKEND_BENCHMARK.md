# Sprint 6 Storage Backend Benchmark

Status: scaffolded (awaiting live PostgreSQL execution)

## Goal
Compare write/read performance deltas for the existing perf harness endpoints (`POST /api/posts`, `GET /api/feed`, `POST /api/reports`) between:
- SQLite (`HUMANONLY_STORAGE_BACKEND=sqlite`)
- PostgreSQL (`HUMANONLY_STORAGE_BACKEND=postgres`)

Both runs use `HUMANONLY_AUDIT_WRITE_MODE=sync` to keep audit durability semantics identical.

## Runner
```bash
# Requires HUMANONLY_POSTGRES_URL in env
npm run perf:storage-backend -- \
  --markdown-output=docs/SPRINT_6_STORAGE_BACKEND_BENCHMARK.md
```

Automation script:
- `apps/web/scripts/perf-storage-backend-compare.ts`

Output artifacts (default):
- `.tmp/perf-backend-compare/sqlite.json`
- `.tmp/perf-backend-compare/postgres.json`
- `docs/SPRINT_6_STORAGE_BACKEND_BENCHMARK.md`

## Blocking prerequisite
A reachable PostgreSQL instance URL in `HUMANONLY_POSTGRES_URL` is required. Current workspace host does not have one configured yet.

## Result table
Pending benchmark run.
