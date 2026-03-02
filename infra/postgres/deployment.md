# Infrastructure Configuration: PostgreSQL

## Multi-Instance Production Deployment

For the Sprint 4 pilot rollout on managed infrastructure, we define the following configuration baseline.

### 1. Connection Pooling (PgBouncer/Supabase-style)

To support multi-instance horizontal scaling (Next.js/Node.js), we use **Transaction Mode** pooling.

- **Pool Size:** `20` (default per instance, adjustable via `HUMANONLY_POSTGRES_POOL_SIZE`).
- **Mode:** `transaction` (recommended for serverless/highly-concurrent Next.js APIs).
- **Idle Timeout:** `10s` (aggressive cleanup for transient lambda/edge runners).
- **Max Connections:** `100` (database-level cap).

### 2. Managed Postgres Configuration (Standard Baseline)

- **Version:** `PostgreSQL 16.x`
- **Instance Size:** `2 vCPU / 4GB RAM` (min recommendation for pilot).
- **Storage:** `10GB SSD` (encrypted at rest).
- **Backup:** `Daily automated snapshot` (7-day retention).
- **Network:** `VPC only` (or restricted allowed-IPs if public-facing).

### 3. Environment Variables

```bash
# Backend selection
HUMANONLY_STORAGE_BACKEND=postgres

# Connection details
HUMANONLY_POSTGRES_URL="postgres://humanonly_user:secure_password@postgres-host:5432/humanonly_db?sslmode=require"

# Advanced pooling (optional)
HUMANONLY_POSTGRES_POOL_SIZE=20
HUMANONLY_POSTGRES_STATEMENT_TIMEOUT=5000 # 5s
```

### 4. Deployment Manifests

#### Docker Compose (Local/Staging Integration)

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

#### Kubernetes / Managed Config (Conceptual)

Use a managed DB service (AWS RDS, GCP Cloud SQL, Supabase, Neon) where possible. 

- **Migration execution:** `POST /api/admin/migration/run` (audited) or `npm run db:migrate`.
- **Secret management:** Connection strings MUST be stored in a secure secret provider (Vault, AWS Secrets Manager, etc.).
- **SSL:** `sslmode=require` (mandatory for non-local traffic).

---

## Performance Tuning Recommendations

1. **Indexes:** Ensure parity with SQLite (`apps/web/db/postgres/schema.sql`).
2. **Vacuum:** Enable `autovacuum` for high-volume write tables (posts, reports).
3. **Observability:** Monitor `pg_stat_statements` for slow query identification during pilot.
