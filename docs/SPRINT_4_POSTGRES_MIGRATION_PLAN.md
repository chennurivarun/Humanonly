# Sprint 4 — PostgreSQL Migration Path (Scale-Out Option)

Status: **In progress** (phase 1 complete: migration plan + schema contract)

## Why this phase

SQLite is excellent for single-node MVP durability. For multi-instance deployment, we need:

- concurrent writers across instances
- centralized durable state
- managed backup/restore workflows
- stronger operational headroom

PostgreSQL is the next relational backend while preserving HumanOnly governance invariants.

## Scope (this phase)

1. Define PostgreSQL schema + indexes equivalent to current SQLite model.
2. Define migration/rollback runbook from SQLite file to PostgreSQL.
3. Define environment contract for selecting backend safely.
4. Keep existing app behavior unchanged by default (`sqlite`).

## Out of scope (next implementation slice)

- Runtime `PostgresStorageAdapter` implementation
- Dual-write or cutover automation scripts
- Connection pooling + managed Postgres deployment manifests

## Proposed schema parity

Tables (same logical entities):

- `users`
- `posts`
- `reports`
- `appeals`

Preserved guarantees:

- immutable audit log remains JSONL hash-chain (unchanged in this phase)
- explicit admin-only override semantics remain in application layer
- role and identity assurance metadata preserved

See: `apps/web/db/postgres/schema.sql`

## Env contract (planned)

```bash
HUMANONLY_STORAGE_BACKEND=postgres
HUMANONLY_POSTGRES_URL=postgres://user:pass@host:5432/humanonly
```

Safety rule for rollout:

- backend switch requires explicit operator action
- default remains `sqlite`
- no implicit backend auto-switching

## Migration runbook (SQLite -> Postgres)

1. **Freeze write window** (short maintenance mode).
2. Backup `HUMANONLY_DB_FILE` and audit log JSONL.
3. Export governed snapshot from SQLite-backed app state.
4. Create PostgreSQL schema from `apps/web/db/postgres/schema.sql`.
5. Import snapshot rows into PostgreSQL tables.
6. Start app with `HUMANONLY_STORAGE_BACKEND=postgres` in staging.
7. Run smoke flow: onboarding -> post -> feed -> report -> moderation.
8. Validate counts + invariants:
   - users/posts/reports/appeals row parity
   - no orphan reports/appeals
   - identity assurance metadata present
9. Promote to production after sign-off.
10. Keep SQLite backup for rollback window.

## Rollback plan

If validation fails after cutover:

1. Switch backend env back to `sqlite`.
2. Restart service.
3. Re-run smoke checks.
4. Investigate and patch migration tooling before next attempt.

## Acceptance criteria for this planning phase

- [x] Schema contract checked in (`apps/web/db/postgres/schema.sql`)
- [x] Migration runbook documented
- [x] Backward-safe default (`sqlite`) maintained
- [ ] Runtime Postgres adapter implemented
- [ ] End-to-end postgres CI job
