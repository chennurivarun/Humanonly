import { Pool } from "pg";
import type { StorageAdapter, StorageHealthDetail } from "./adapter";
import type { GovernedStore } from "@/lib/governed-store";
import type { IdentityProfile, Post, Report, Appeal } from "@/lib/store";
import type { IdentityAssuranceLevel, IdentityAssuranceSignal } from "@/lib/auth/assurance";

// ── Schema SQL (mirrors apps/web/db/postgres/schema.sql) ─────────────────────

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  handle TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL,
  governance_accepted_at TEXT NOT NULL,
  human_verified_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  identity_assurance_level TEXT,
  identity_assurance_signals JSONB,
  identity_assurance_evaluated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_users_handle ON users(handle);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_posts_author_id ON posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  reporter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_post_id ON reports(post_id);
CREATE INDEX IF NOT EXISTS idx_reports_reporter_id ON reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);

CREATE TABLE IF NOT EXISTS appeals (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  appellant_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL,
  appealed_audit_record_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  decided_at TEXT,
  decided_by_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  decision_rationale TEXT
);

CREATE INDEX IF NOT EXISTS idx_appeals_status ON appeals(status);
CREATE INDEX IF NOT EXISTS idx_appeals_report_id ON appeals(report_id);
CREATE INDEX IF NOT EXISTS idx_appeals_appellant_id ON appeals(appellant_id);
CREATE INDEX IF NOT EXISTS idx_appeals_updated_at ON appeals(updated_at DESC);
`;

// ── Env resolution ────────────────────────────────────────────────────────────

function resolvePostgresUrl(): string {
  const url = process.env.HUMANONLY_POSTGRES_URL?.trim();
  if (!url) {
    throw new Error(
      "HUMANONLY_POSTGRES_URL must be set when HUMANONLY_STORAGE_BACKEND=postgres"
    );
  }
  return url;
}

// ── Row types (postgres column names differ from SQLite) ──────────────────────
// Postgres: identity_assurance_level, identity_assurance_signals (JSONB),
//           identity_assurance_evaluated_at
// SQLite:   assurance_level, assurance_signals_json (TEXT), assurance_evaluated_at

type UserRow = {
  id: string;
  handle: string;
  display_name: string;
  role: string;
  governance_accepted_at: string;
  human_verified_at: string;
  created_at: string;
  updated_at: string;
  identity_assurance_level: string | null;
  // pg auto-parses JSONB → JavaScript value (array in this case)
  identity_assurance_signals: unknown;
  identity_assurance_evaluated_at: string | null;
};

type PostRow = {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
};

type ReportRow = {
  id: string;
  post_id: string;
  reporter_id: string;
  reason: string;
  status: string;
  created_at: string;
};

type AppealRow = {
  id: string;
  report_id: string;
  appellant_id: string;
  reason: string;
  status: string;
  appealed_audit_record_id: string | null;
  created_at: string;
  updated_at: string;
  decided_at: string | null;
  decided_by_id: string | null;
  decision_rationale: string | null;
};

// ── Row → domain type mappings ────────────────────────────────────────────────

const ALLOWED_ASSURANCE_LEVELS = new Set<IdentityAssuranceLevel>([
  "attested",
  "enhanced",
  "manual_override"
]);

const ALLOWED_ASSURANCE_SIGNALS = new Set<IdentityAssuranceSignal>([
  "attestation",
  "governance_commitment",
  "interactive_challenge",
  "manual_override",
  "seed_bootstrap"
]);

function parseAssuranceSignals(value: unknown): IdentityAssuranceSignal[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const filtered = (value as unknown[]).filter(
    (entry): entry is IdentityAssuranceSignal =>
      typeof entry === "string" && ALLOWED_ASSURANCE_SIGNALS.has(entry as IdentityAssuranceSignal)
  );
  return filtered.length > 0 ? filtered : undefined;
}

function rowToUser(row: UserRow): IdentityProfile {
  const identity: IdentityProfile = {
    id: row.id,
    handle: row.handle,
    displayName: row.display_name,
    role: row.role as IdentityProfile["role"],
    governanceAcceptedAt: row.governance_accepted_at,
    humanVerifiedAt: row.human_verified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };

  const level = row.identity_assurance_level;
  if (level !== null && ALLOWED_ASSURANCE_LEVELS.has(level as IdentityAssuranceLevel)) {
    identity.identityAssuranceLevel = level as IdentityAssuranceLevel;
  }

  const signals = parseAssuranceSignals(row.identity_assurance_signals);
  if (signals) {
    identity.identityAssuranceSignals = signals;
  }

  if (row.identity_assurance_evaluated_at) {
    identity.identityAssuranceEvaluatedAt = row.identity_assurance_evaluated_at;
  }

  return identity;
}

function rowToPost(row: PostRow): Post {
  return {
    id: row.id,
    authorId: row.author_id,
    body: row.body,
    createdAt: row.created_at
  };
}

function rowToReport(row: ReportRow): Report {
  return {
    id: row.id,
    postId: row.post_id,
    reporterId: row.reporter_id,
    reason: row.reason,
    status: row.status as Report["status"],
    createdAt: row.created_at
  };
}

function rowToAppeal(row: AppealRow): Appeal {
  const appeal: Appeal = {
    id: row.id,
    reportId: row.report_id,
    appellantId: row.appellant_id,
    reason: row.reason,
    status: row.status as Appeal["status"],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };

  if (row.appealed_audit_record_id !== null) {
    appeal.appealedAuditRecordId = row.appealed_audit_record_id;
  }
  if (row.decided_at !== null) {
    appeal.decidedAt = row.decided_at;
  }
  if (row.decided_by_id !== null) {
    appeal.decidedById = row.decided_by_id;
  }
  if (row.decision_rationale !== null) {
    appeal.decisionRationale = row.decision_rationale;
  }

  return appeal;
}

// ── PostgresStorageAdapter ────────────────────────────────────────────────────

/**
 * PostgreSQL storage adapter.
 *
 * Select this backend by setting:
 *   HUMANONLY_STORAGE_BACKEND=postgres
 *   HUMANONLY_POSTGRES_URL=postgres://user:pass@host:5432/humanonly
 *
 * Uses connection pooling via `pg.Pool`. Schema is applied idempotently on
 * `initialize()`. `flush()` runs inside a single transaction with FK-safe
 * ordering: children deleted before parents, parents upserted before children.
 *
 * Governance invariants are preserved:
 * - Human expression only
 * - AI-managed operations only
 * - Human-governed decisions only
 * - Auditability required
 * - Admin-only human override
 */
export class PostgresStorageAdapter implements StorageAdapter {
  private readonly pool: Pool;

  /**
   * @param pool Optional pg.Pool to use. If omitted, a pool is created from
   *   the `HUMANONLY_POSTGRES_URL` environment variable.
   */
  constructor(pool?: Pool) {
    this.pool = pool ?? new Pool({ connectionString: resolvePostgresUrl() });
  }

  /**
   * Apply schema DDL idempotently. Safe to call on an already-initialized DB.
   */
  async initialize(): Promise<void> {
    // Simple query protocol (no $N params) supports multiple statements.
    await this.pool.query(SCHEMA_SQL);
  }

  /**
   * Load all governed entities from Postgres.
   * Ordering matches SQLite adapter semantics:
   *   users → ASC created_at
   *   posts/reports/appeals → DESC created_at (newest first, matches in-memory unshift pattern)
   */
  async loadAll(): Promise<GovernedStore> {
    const [usersRes, postsRes, reportsRes, appealsRes] = await Promise.all([
      this.pool.query<UserRow>("SELECT * FROM users ORDER BY created_at ASC"),
      this.pool.query<PostRow>("SELECT * FROM posts ORDER BY created_at DESC"),
      this.pool.query<ReportRow>("SELECT * FROM reports ORDER BY created_at DESC"),
      this.pool.query<AppealRow>("SELECT * FROM appeals ORDER BY created_at DESC")
    ]);

    return {
      users: usersRes.rows.map(rowToUser),
      posts: postsRes.rows.map(rowToPost),
      reports: reportsRes.rows.map(rowToReport),
      appeals: appealsRes.rows.map(rowToAppeal)
    };
  }

  /**
   * Atomically replace all durable state with the current in-memory store.
   *
   * Deletion order (children first, respects FK constraints):
   *   appeals → reports → posts → users
   *
   * Upsert order (parents first):
   *   users → posts → reports → appeals
   *
   * Uses `id != ALL($1::text[])` for NOT-IN semantics that correctly handles
   * empty arrays: `!= ALL('{}')` is vacuously true → deletes all rows.
   */
  async flush(store: GovernedStore): Promise<void> {
    const keepUserIds = store.users.map((u) => u.id);
    const keepPostIds = store.posts.map((p) => p.id);
    const keepReportIds = store.reports.map((r) => r.id);
    const keepAppealIds = store.appeals.map((a) => a.id);

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      // ── Delete removed records (children first) ───────────────────────────

      await client.query(
        "DELETE FROM appeals WHERE id != ALL($1::text[])",
        [keepAppealIds]
      );
      await client.query(
        "DELETE FROM reports WHERE id != ALL($1::text[])",
        [keepReportIds]
      );
      await client.query(
        "DELETE FROM posts WHERE id != ALL($1::text[])",
        [keepPostIds]
      );
      await client.query(
        "DELETE FROM users WHERE id != ALL($1::text[])",
        [keepUserIds]
      );

      // ── Upsert current records (parents first) ────────────────────────────

      for (const user of store.users) {
        await client.query(
          `INSERT INTO users
             (id, handle, display_name, role, governance_accepted_at, human_verified_at,
              created_at, updated_at, identity_assurance_level,
              identity_assurance_signals, identity_assurance_evaluated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (id) DO UPDATE SET
             handle                          = EXCLUDED.handle,
             display_name                    = EXCLUDED.display_name,
             role                            = EXCLUDED.role,
             governance_accepted_at          = EXCLUDED.governance_accepted_at,
             human_verified_at               = EXCLUDED.human_verified_at,
             created_at                      = EXCLUDED.created_at,
             updated_at                      = EXCLUDED.updated_at,
             identity_assurance_level        = EXCLUDED.identity_assurance_level,
             identity_assurance_signals      = EXCLUDED.identity_assurance_signals,
             identity_assurance_evaluated_at = EXCLUDED.identity_assurance_evaluated_at`,
          [
            user.id,
            user.handle,
            user.displayName,
            user.role,
            user.governanceAcceptedAt,
            user.humanVerifiedAt,
            user.createdAt,
            user.updatedAt,
            user.identityAssuranceLevel ?? null,
            user.identityAssuranceSignals
              ? JSON.stringify(user.identityAssuranceSignals)
              : null,
            user.identityAssuranceEvaluatedAt ?? null
          ]
        );
      }

      for (const post of store.posts) {
        await client.query(
          `INSERT INTO posts (id, author_id, body, created_at)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (id) DO UPDATE SET
             author_id  = EXCLUDED.author_id,
             body       = EXCLUDED.body,
             created_at = EXCLUDED.created_at`,
          [post.id, post.authorId, post.body, post.createdAt]
        );
      }

      for (const report of store.reports) {
        await client.query(
          `INSERT INTO reports (id, post_id, reporter_id, reason, status, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO UPDATE SET
             post_id     = EXCLUDED.post_id,
             reporter_id = EXCLUDED.reporter_id,
             reason      = EXCLUDED.reason,
             status      = EXCLUDED.status,
             created_at  = EXCLUDED.created_at`,
          [
            report.id,
            report.postId,
            report.reporterId,
            report.reason,
            report.status,
            report.createdAt
          ]
        );
      }

      for (const appeal of store.appeals) {
        await client.query(
          `INSERT INTO appeals
             (id, report_id, appellant_id, reason, status, appealed_audit_record_id,
              created_at, updated_at, decided_at, decided_by_id, decision_rationale)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (id) DO UPDATE SET
             report_id                = EXCLUDED.report_id,
             appellant_id             = EXCLUDED.appellant_id,
             reason                   = EXCLUDED.reason,
             status                   = EXCLUDED.status,
             appealed_audit_record_id = EXCLUDED.appealed_audit_record_id,
             created_at               = EXCLUDED.created_at,
             updated_at               = EXCLUDED.updated_at,
             decided_at               = EXCLUDED.decided_at,
             decided_by_id            = EXCLUDED.decided_by_id,
             decision_rationale       = EXCLUDED.decision_rationale`,
          [
            appeal.id,
            appeal.reportId,
            appeal.appellantId,
            appeal.reason,
            appeal.status,
            appeal.appealedAuditRecordId ?? null,
            appeal.createdAt,
            appeal.updatedAt,
            appeal.decidedAt ?? null,
            appeal.decidedById ?? null,
            appeal.decisionRationale ?? null
          ]
        );
      }

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async healthCheck(): Promise<StorageHealthDetail> {
    try {
      await this.pool.query("SELECT 1");
      return {
        backend: "postgres",
        healthy: true,
        detail: "PostgreSQL connection reachable"
      };
    } catch (err) {
      return {
        backend: "postgres",
        healthy: false,
        detail: `PostgreSQL connection error: ${(err as Error).message}`
      };
    }
  }
}
