# Infrastructure Configuration: PostgreSQL

## Multi-Instance Production Deployment

For Sprint 6 production hardening, this is the governed baseline for managed PostgreSQL rollouts.

### 1) Connection pooling defaults (finalized)

HumanOnly now applies explicit pool policy when `HUMANONLY_STORAGE_BACKEND=postgres`:

- **Pool size (`HUMANONLY_POSTGRES_POOL_SIZE`)**: `20` per app instance
- **Idle timeout (`HUMANONLY_POSTGRES_IDLE_TIMEOUT_MS`)**: `10000`
- **Connection timeout (`HUMANONLY_POSTGRES_CONNECTION_TIMEOUT_MS`)**: `5000`
- **Statement timeout (`HUMANONLY_POSTGRES_STATEMENT_TIMEOUT_MS`)**: `5000`
- **Query timeout (`HUMANONLY_POSTGRES_QUERY_TIMEOUT_MS`)**: `5000`
- **Connection max uses (`HUMANONLY_POSTGRES_MAX_USES`)**: `0` (disabled; no forced churn)
- **TLS mode (`HUMANONLY_POSTGRES_SSL_MODE`)**: `require` by default

Production guardrail:
- If `NODE_ENV=production` and SSL mode is set to `disable` **without** `HUMANONLY_POSTGRES_SSL_DISABLE_APPROVED=1`, runtime forces `ssl=require`.

This preserves:
- Human expression only
- AI-managed operations only
- Human-governed decisions
- Auditability + explicit override controls

### 2) Managed Postgres baseline

- **Version:** PostgreSQL `16.x`
- **Instance class (minimum):** `2 vCPU / 4GB RAM`
- **Storage:** encrypted SSD, min `10GB`
- **Network:** private/VPC preferred (or strict IP allow-list)
- **Backups:** daily snapshot (>= 7-day retention)
- **Observability:** `pg_stat_statements`, connection saturation, and lock wait dashboards

### 3) Environment contract

```bash
# Backend selection
HUMANONLY_STORAGE_BACKEND=postgres

# Connection details
HUMANONLY_POSTGRES_URL="postgres://humanonly_user:secure_password@postgres-host:5432/humanonly_db?sslmode=require"

# Pooling + timeout policy
HUMANONLY_POSTGRES_POOL_SIZE=20
HUMANONLY_POSTGRES_IDLE_TIMEOUT_MS=10000
HUMANONLY_POSTGRES_CONNECTION_TIMEOUT_MS=5000
HUMANONLY_POSTGRES_STATEMENT_TIMEOUT_MS=5000
HUMANONLY_POSTGRES_QUERY_TIMEOUT_MS=5000
HUMANONLY_POSTGRES_MAX_USES=0
HUMANONLY_POSTGRES_APPLICATION_NAME=humanonly-web

# TLS policy
HUMANONLY_POSTGRES_SSL_MODE=require
HUMANONLY_POSTGRES_SSL_DISABLE_APPROVED=0
```

### 4) Cutover automation (SQLite → Postgres)

Use governed cutover script with explicit human approval references:

```bash
# 1) Plan (no writes)
npm run db:cutover:postgres -w apps/web -- \
  --action=plan \
  --postgres-url="postgres://..." \
  --output=.tmp/postgres-cutover/plan.json

# 2) Apply (requires explicit approval reference)
npm run db:cutover:postgres -w apps/web -- \
  --action=apply \
  --execute \
  --human-approval-ref=CHANGE-2026-03-04 \
  --postgres-url="postgres://..." \
  --output=.tmp/postgres-cutover/apply.json

# 3) Verify parity after cutover
npm run db:cutover:postgres -w apps/web -- \
  --action=verify \
  --postgres-url="postgres://..." \
  --output=.tmp/postgres-cutover/verify.json
```

Governance guarantees in cutover workflow:
- **Human-governed decisions:** apply requires `--execute` + `--human-approval-ref`
- **Auditability:** JSON report artifact on every run
- **Human override:** rollback remains immediate via backend switch to SQLite

### 5) Docker Compose (local/staging)

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: humanonly_db
      POSTGRES_USER: humanonly_user
      POSTGRES_PASSWORD: secure_password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ../../apps/web/db/postgres/schema.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U humanonly_user -d humanonly_db"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

## Performance tuning recommendations

1. Keep schema/index parity with SQLite baseline (`apps/web/db/postgres/schema.sql`).
2. Ensure autovacuum tuning for write-heavy entities (`posts`, `reports`, `appeals`).
3. Monitor p95 write latency + pool saturation during managed rollout validation.
