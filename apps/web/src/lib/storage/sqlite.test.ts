import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import Database from "better-sqlite3";
import { SqliteStorageAdapter } from "./sqlite";
import type { GovernedStore } from "@/lib/governed-store";
import type { IdentityProfile, Post, Report, Appeal } from "@/lib/store";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function tempDbPath(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "humanonly-sqlite-"));
  return path.join(dir, "test.db");
}

function makeUser(overrides: Partial<IdentityProfile> = {}): IdentityProfile {
  return {
    id: "usr_test",
    handle: "test_user",
    displayName: "Test User",
    role: "member",
    governanceAcceptedAt: "2026-02-01T00:00:00.000Z",
    humanVerifiedAt: "2026-02-01T00:00:00.000Z",
    identityAssuranceLevel: "enhanced",
    identityAssuranceSignals: ["attestation", "governance_commitment", "interactive_challenge"],
    identityAssuranceEvaluatedAt: "2026-02-01T00:00:05.000Z",
    createdAt: "2026-02-01T00:00:00.000Z",
    updatedAt: "2026-02-01T00:00:00.000Z",
    ...overrides
  };
}

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: "pst_test",
    authorId: "usr_test",
    body: "Test post body",
    createdAt: "2026-02-01T00:10:00.000Z",
    ...overrides
  };
}

function makeReport(overrides: Partial<Report> = {}): Report {
  return {
    id: "rpt_test",
    postId: "pst_test",
    reporterId: "usr_test",
    reason: "Test reason",
    status: "open",
    createdAt: "2026-02-01T00:20:00.000Z",
    ...overrides
  };
}

function makeAppeal(overrides: Partial<Appeal> = {}): Appeal {
  return {
    id: "apl_test",
    reportId: "rpt_test",
    appellantId: "usr_test",
    reason: "Test appeal",
    status: "open",
    createdAt: "2026-02-01T00:30:00.000Z",
    updatedAt: "2026-02-01T00:30:00.000Z",
    ...overrides
  };
}

function buildStore(partial: Partial<GovernedStore> = {}): GovernedStore {
  return {
    users: [makeUser()],
    posts: [makePost()],
    reports: [makeReport()],
    appeals: [makeAppeal()],
    ...partial
  };
}

// ── initialize ────────────────────────────────────────────────────────────────

describe("SqliteStorageAdapter.initialize", () => {
  it("creates the DB file and schema tables", async () => {
    const adapter = new SqliteStorageAdapter(tempDbPath());
    await adapter.initialize();

    const loaded = await adapter.loadAll();
    assert.deepEqual(loaded, { users: [], posts: [], reports: [], appeals: [] });
  });

  it("is idempotent — calling initialize twice does not throw", async () => {
    const dbPath = tempDbPath();
    const adapter = new SqliteStorageAdapter(dbPath);
    await adapter.initialize();
    await adapter.initialize();
  });

  it("migrates legacy users tables by adding assurance columns", async () => {
    const dbPath = tempDbPath();
    const legacyDb = new Database(dbPath);

    legacyDb.exec(`
      CREATE TABLE users (
        id                     TEXT PRIMARY KEY NOT NULL,
        handle                 TEXT NOT NULL,
        display_name           TEXT NOT NULL,
        role                   TEXT NOT NULL,
        governance_accepted_at TEXT NOT NULL,
        human_verified_at      TEXT NOT NULL,
        created_at             TEXT NOT NULL,
        updated_at             TEXT NOT NULL
      );
      CREATE TABLE posts (
        id         TEXT PRIMARY KEY NOT NULL,
        author_id  TEXT NOT NULL,
        body       TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE reports (
        id          TEXT PRIMARY KEY NOT NULL,
        post_id     TEXT NOT NULL,
        reporter_id TEXT NOT NULL,
        reason      TEXT NOT NULL,
        status      TEXT NOT NULL DEFAULT 'open',
        created_at  TEXT NOT NULL
      );
      CREATE TABLE appeals (
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
    `);

    legacyDb.close();

    const adapter = new SqliteStorageAdapter(dbPath);
    await adapter.initialize();

    await adapter.flush(
      buildStore({
        users: [
          makeUser({
            identityAssuranceLevel: "enhanced",
            identityAssuranceSignals: ["attestation", "governance_commitment", "interactive_challenge"],
            identityAssuranceEvaluatedAt: "2026-02-01T00:00:05.000Z"
          })
        ]
      })
    );

    const loaded = await adapter.loadAll();
    assert.equal(loaded.users[0]?.identityAssuranceLevel, "enhanced");
    assert.deepEqual(loaded.users[0]?.identityAssuranceSignals, [
      "attestation",
      "governance_commitment",
      "interactive_challenge"
    ]);
  });
});

// ── flush + loadAll ───────────────────────────────────────────────────────────

describe("SqliteStorageAdapter.flush + loadAll", () => {
  it("round-trips all entity types", async () => {
    const adapter = new SqliteStorageAdapter(tempDbPath());
    await adapter.initialize();

    const store = buildStore();
    await adapter.flush(store);

    const loaded = await adapter.loadAll();

    assert.equal(loaded.users.length, 1);
    assert.equal(loaded.users[0]?.handle, "test_user");
    assert.equal(loaded.users[0]?.role, "member");

    assert.equal(loaded.posts.length, 1);
    assert.equal(loaded.posts[0]?.body, "Test post body");

    assert.equal(loaded.reports.length, 1);
    assert.equal(loaded.reports[0]?.status, "open");

    assert.equal(loaded.appeals.length, 1);
    assert.equal(loaded.appeals[0]?.reason, "Test appeal");
  });

  it("persists all IdentityProfile fields", async () => {
    const adapter = new SqliteStorageAdapter(tempDbPath());
    await adapter.initialize();

    const user = makeUser({ role: "admin", displayName: "Chief Admin" });
    await adapter.flush(buildStore({ users: [user] }));

    const { users } = await adapter.loadAll();
    const loaded = users[0];
    assert.ok(loaded);
    assert.equal(loaded.id, user.id);
    assert.equal(loaded.handle, user.handle);
    assert.equal(loaded.displayName, user.displayName);
    assert.equal(loaded.role, user.role);
    assert.equal(loaded.governanceAcceptedAt, user.governanceAcceptedAt);
    assert.equal(loaded.humanVerifiedAt, user.humanVerifiedAt);
    assert.equal(loaded.identityAssuranceLevel, user.identityAssuranceLevel);
    assert.deepEqual(loaded.identityAssuranceSignals, user.identityAssuranceSignals);
    assert.equal(loaded.identityAssuranceEvaluatedAt, user.identityAssuranceEvaluatedAt);
    assert.equal(loaded.createdAt, user.createdAt);
    assert.equal(loaded.updatedAt, user.updatedAt);
  });

  it("omits optional IdentityProfile assurance fields when undefined", async () => {
    const adapter = new SqliteStorageAdapter(tempDbPath());
    await adapter.initialize();

    const user = makeUser({
      identityAssuranceLevel: undefined,
      identityAssuranceSignals: undefined,
      identityAssuranceEvaluatedAt: undefined
    });

    await adapter.flush(buildStore({ users: [user] }));

    const { users } = await adapter.loadAll();
    const loaded = users[0];
    assert.ok(loaded);
    assert.equal(loaded.identityAssuranceLevel, undefined);
    assert.equal(loaded.identityAssuranceSignals, undefined);
    assert.equal(loaded.identityAssuranceEvaluatedAt, undefined);
  });

  it("persists optional Appeal fields", async () => {
    const adapter = new SqliteStorageAdapter(tempDbPath());
    await adapter.initialize();

    const appeal = makeAppeal({
      appealedAuditRecordId: "rec_123",
      status: "granted",
      decidedAt: "2026-02-10T00:00:00.000Z",
      decidedById: "usr_mod",
      decisionRationale: "Granted on review"
    });

    await adapter.flush(buildStore({ appeals: [appeal] }));

    const { appeals } = await adapter.loadAll();
    const loaded = appeals[0];
    assert.ok(loaded);
    assert.equal(loaded.appealedAuditRecordId, "rec_123");
    assert.equal(loaded.status, "granted");
    assert.equal(loaded.decidedAt, "2026-02-10T00:00:00.000Z");
    assert.equal(loaded.decidedById, "usr_mod");
    assert.equal(loaded.decisionRationale, "Granted on review");
  });

  it("omits undefined optional Appeal fields from loaded record", async () => {
    const adapter = new SqliteStorageAdapter(tempDbPath());
    await adapter.initialize();

    const appeal = makeAppeal(); // No optional fields
    await adapter.flush(buildStore({ appeals: [appeal] }));

    const { appeals } = await adapter.loadAll();
    const loaded = appeals[0];
    assert.ok(loaded);
    assert.equal(loaded.appealedAuditRecordId, undefined);
    assert.equal(loaded.decidedAt, undefined);
    assert.equal(loaded.decidedById, undefined);
    assert.equal(loaded.decisionRationale, undefined);
  });

  it("overwrites previous state on re-flush (upsert semantics)", async () => {
    const adapter = new SqliteStorageAdapter(tempDbPath());
    await adapter.initialize();

    const report = makeReport({ status: "open" });
    await adapter.flush(buildStore({ reports: [report] }));

    // Mutate and flush again
    const updated = { ...report, status: "resolved" as const };
    await adapter.flush(buildStore({ reports: [updated] }));

    const { reports } = await adapter.loadAll();
    assert.equal(reports[0]?.status, "resolved");
  });

  it("removes records deleted from in-memory store", async () => {
    const adapter = new SqliteStorageAdapter(tempDbPath());
    await adapter.initialize();

    const store = buildStore({
      posts: [makePost({ id: "pst_a" }), makePost({ id: "pst_b" })]
    });
    await adapter.flush(store);

    // Remove one post and flush
    const reduced = { ...store, posts: [makePost({ id: "pst_a" })] };
    await adapter.flush(reduced);

    const { posts } = await adapter.loadAll();
    assert.equal(posts.length, 1);
    assert.equal(posts[0]?.id, "pst_a");
  });

  it("handles empty store flush without errors", async () => {
    const adapter = new SqliteStorageAdapter(tempDbPath());
    await adapter.initialize();

    await adapter.flush({ users: [], posts: [], reports: [], appeals: [] });

    const loaded = await adapter.loadAll();
    assert.deepEqual(loaded, { users: [], posts: [], reports: [], appeals: [] });
  });
});

// ── healthCheck ───────────────────────────────────────────────────────────────

describe("SqliteStorageAdapter.healthCheck", () => {
  it("reports healthy after initialize", async () => {
    const adapter = new SqliteStorageAdapter(tempDbPath());
    await adapter.initialize();

    const health = await adapter.healthCheck();

    assert.equal(health.backend, "sqlite");
    assert.equal(health.healthy, true);
    assert.ok(typeof health.info?.filePath === "string");
    assert.equal(health.info?.exists, true);
    assert.ok(typeof health.info?.sizeBytes === "number");
    assert.ok(typeof health.info?.lastModifiedAt === "string");
  });

  it("reports unhealthy for a missing DB file", async () => {
    const adapter = new SqliteStorageAdapter("/nonexistent/path/test.db");

    const health = await adapter.healthCheck();

    assert.equal(health.backend, "sqlite");
    assert.equal(health.healthy, false);
    assert.equal(health.info?.exists, false);
  });
});

// ── persistence across instances ──────────────────────────────────────────────

describe("SqliteStorageAdapter durability", () => {
  it("data persists when a new adapter instance opens the same DB file", async () => {
    const dbPath = tempDbPath();

    const writer = new SqliteStorageAdapter(dbPath);
    await writer.initialize();
    await writer.flush(buildStore());

    // Simulate server restart by creating a fresh adapter instance
    const reader = new SqliteStorageAdapter(dbPath);
    await reader.initialize();
    const loaded = await reader.loadAll();

    assert.equal(loaded.users.length, 1);
    assert.equal(loaded.posts.length, 1);
    assert.equal(loaded.reports.length, 1);
    assert.equal(loaded.appeals.length, 1);
  });
});
