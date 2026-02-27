import Database from "better-sqlite3";
import { mkdirSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import type { StorageAdapter, StorageHealthDetail } from "./adapter";
import type { GovernedStore } from "@/lib/governed-store";
import type { IdentityProfile, Post, Report, Appeal } from "@/lib/store";

const DEFAULT_DB_FILE = ".data/store.db";

function resolveDbFilePath(): string {
  const configured = process.env.HUMANONLY_DB_FILE?.trim() || DEFAULT_DB_FILE;
  return path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured);
}

// ── Schema SQL ────────────────────────────────────────────────────────────────

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id                     TEXT PRIMARY KEY NOT NULL,
  handle                 TEXT NOT NULL,
  display_name           TEXT NOT NULL,
  role                   TEXT NOT NULL,
  governance_accepted_at TEXT NOT NULL,
  human_verified_at      TEXT NOT NULL,
  created_at             TEXT NOT NULL,
  updated_at             TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_handle ON users(handle);

CREATE TABLE IF NOT EXISTS posts (
  id         TEXT PRIMARY KEY NOT NULL,
  author_id  TEXT NOT NULL,
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_posts_author_id  ON posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at);

CREATE TABLE IF NOT EXISTS reports (
  id          TEXT PRIMARY KEY NOT NULL,
  post_id     TEXT NOT NULL,
  reporter_id TEXT NOT NULL,
  reason      TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'open',
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reports_status    ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_post_id   ON reports(post_id);
CREATE INDEX IF NOT EXISTS idx_reports_reporter_id ON reports(reporter_id);

CREATE TABLE IF NOT EXISTS appeals (
  id                       TEXT PRIMARY KEY NOT NULL,
  report_id                TEXT NOT NULL,
  appellant_id             TEXT NOT NULL,
  reason                   TEXT NOT NULL,
  status                   TEXT NOT NULL DEFAULT 'open',
  appealed_audit_record_id TEXT,
  created_at               TEXT NOT NULL,
  updated_at               TEXT NOT NULL,
  decided_at               TEXT,
  decided_by_id            TEXT,
  decision_rationale       TEXT
);

CREATE INDEX IF NOT EXISTS idx_appeals_status       ON appeals(status);
CREATE INDEX IF NOT EXISTS idx_appeals_report_id    ON appeals(report_id);
CREATE INDEX IF NOT EXISTS idx_appeals_appellant_id ON appeals(appellant_id);
`;

// ── Row → domain type mappings ────────────────────────────────────────────────

type UserRow = {
  id: string;
  handle: string;
  display_name: string;
  role: string;
  governance_accepted_at: string;
  human_verified_at: string;
  created_at: string;
  updated_at: string;
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

function rowToUser(row: UserRow): IdentityProfile {
  return {
    id: row.id,
    handle: row.handle,
    displayName: row.display_name,
    role: row.role as IdentityProfile["role"],
    governanceAcceptedAt: row.governance_accepted_at,
    humanVerifiedAt: row.human_verified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
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

// ── SqliteStorageAdapter ──────────────────────────────────────────────────────

export class SqliteStorageAdapter implements StorageAdapter {
  private readonly dbFilePath: string;
  private db: InstanceType<typeof Database> | null = null;

  constructor(dbFilePath?: string) {
    this.dbFilePath = dbFilePath ?? resolveDbFilePath();
  }

  private openDb(): InstanceType<typeof Database> {
    if (this.db) {
      return this.db;
    }

    mkdirSync(path.dirname(this.dbFilePath), { recursive: true });
    this.db = new Database(this.dbFilePath);
    // Enable WAL mode for better concurrent read performance
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    return this.db;
  }

  initialize(): void {
    const db = this.openDb();
    db.exec(SCHEMA_SQL);
  }

  loadAll(): GovernedStore {
    const db = this.openDb();

    const users = (db.prepare("SELECT * FROM users ORDER BY created_at ASC").all() as UserRow[]).map(rowToUser);
    // Posts are stored newest-first in memory (unshift pattern), sort desc to match
    const posts = (db.prepare("SELECT * FROM posts ORDER BY created_at DESC").all() as PostRow[]).map(rowToPost);
    const reports = (
      db.prepare("SELECT * FROM reports ORDER BY created_at DESC").all() as ReportRow[]
    ).map(rowToReport);
    const appeals = (
      db.prepare("SELECT * FROM appeals ORDER BY created_at DESC").all() as AppealRow[]
    ).map(rowToAppeal);

    return { users, posts, reports, appeals };
  }

  flush(store: GovernedStore): void {
    const db = this.openDb();

    const upsertUsers = db.prepare(`
      INSERT OR REPLACE INTO users
        (id, handle, display_name, role, governance_accepted_at, human_verified_at, created_at, updated_at)
      VALUES
        (@id, @handle, @displayName, @role, @governanceAcceptedAt, @humanVerifiedAt, @createdAt, @updatedAt)
    `);

    const upsertPosts = db.prepare(`
      INSERT OR REPLACE INTO posts (id, author_id, body, created_at)
      VALUES (@id, @authorId, @body, @createdAt)
    `);

    const upsertReports = db.prepare(`
      INSERT OR REPLACE INTO reports (id, post_id, reporter_id, reason, status, created_at)
      VALUES (@id, @postId, @reporterId, @reason, @status, @createdAt)
    `);

    const upsertAppeals = db.prepare(`
      INSERT OR REPLACE INTO appeals
        (id, report_id, appellant_id, reason, status, appealed_audit_record_id,
         created_at, updated_at, decided_at, decided_by_id, decision_rationale)
      VALUES
        (@id, @reportId, @appellantId, @reason, @status, @appealedAuditRecordId,
         @createdAt, @updatedAt, @decidedAt, @decidedById, @decisionRationale)
    `);

    // Collect IDs to delete records removed from memory
    const keepUserIds = store.users.map((u) => u.id);
    const keepPostIds = store.posts.map((p) => p.id);
    const keepReportIds = store.reports.map((r) => r.id);
    const keepAppealIds = store.appeals.map((a) => a.id);

    const txn = db.transaction(() => {
      // Delete removed records
      if (keepUserIds.length === 0) {
        db.prepare("DELETE FROM users").run();
      } else {
        db.prepare(`DELETE FROM users WHERE id NOT IN (${keepUserIds.map(() => "?").join(",")})`).run(keepUserIds);
      }

      if (keepPostIds.length === 0) {
        db.prepare("DELETE FROM posts").run();
      } else {
        db.prepare(`DELETE FROM posts WHERE id NOT IN (${keepPostIds.map(() => "?").join(",")})`).run(keepPostIds);
      }

      if (keepReportIds.length === 0) {
        db.prepare("DELETE FROM reports").run();
      } else {
        db.prepare(`DELETE FROM reports WHERE id NOT IN (${keepReportIds.map(() => "?").join(",")})`).run(
          keepReportIds
        );
      }

      if (keepAppealIds.length === 0) {
        db.prepare("DELETE FROM appeals").run();
      } else {
        db.prepare(`DELETE FROM appeals WHERE id NOT IN (${keepAppealIds.map(() => "?").join(",")})`).run(
          keepAppealIds
        );
      }

      // Upsert all in-memory records
      for (const user of store.users) {
        upsertUsers.run(user);
      }

      for (const post of store.posts) {
        upsertPosts.run(post);
      }

      for (const report of store.reports) {
        upsertReports.run(report);
      }

      for (const appeal of store.appeals) {
        upsertAppeals.run({
          id: appeal.id,
          reportId: appeal.reportId,
          appellantId: appeal.appellantId,
          reason: appeal.reason,
          status: appeal.status,
          appealedAuditRecordId: appeal.appealedAuditRecordId ?? null,
          createdAt: appeal.createdAt,
          updatedAt: appeal.updatedAt,
          decidedAt: appeal.decidedAt ?? null,
          decidedById: appeal.decidedById ?? null,
          decisionRationale: appeal.decisionRationale ?? null
        });
      }
    });

    txn();
  }

  healthCheck(): StorageHealthDetail {
    const filePath = this.dbFilePath;

    if (!existsSync(filePath)) {
      return {
        backend: "sqlite",
        healthy: false,
        detail: `SQLite database file not found: ${filePath}`,
        info: { filePath, exists: false, sizeBytes: null, lastModifiedAt: null }
      };
    }

    try {
      const stat = statSync(filePath);
      // Verify the DB is readable by executing a lightweight query
      const db = this.openDb();
      db.prepare("SELECT 1").get();

      return {
        backend: "sqlite",
        healthy: true,
        detail: `SQLite database reachable`,
        info: {
          filePath,
          exists: true,
          sizeBytes: stat.size,
          lastModifiedAt: stat.mtime.toISOString()
        }
      };
    } catch (err) {
      return {
        backend: "sqlite",
        healthy: false,
        detail: `SQLite database error: ${(err as Error).message}`,
        info: { filePath, exists: true, sizeBytes: null, lastModifiedAt: null }
      };
    }
  }
}
