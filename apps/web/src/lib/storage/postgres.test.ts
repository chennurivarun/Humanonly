/**
 * PostgresStorageAdapter unit tests using a mock pg.Pool.
 *
 * No real Postgres connection is required. The MockPool captures all SQL
 * and returns pre-configured rows, allowing full behavioral coverage.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Pool } from "pg";
import { PostgresStorageAdapter } from "./postgres";
import type { GovernedStore } from "@/lib/governed-store";
import type { IdentityProfile, Post, Report, Appeal } from "@/lib/store";

// ── Mock infrastructure ───────────────────────────────────────────────────────

type QueryEntry = { text: string; values?: unknown[] };

class MockClient {
  constructor(
    private readonly log: QueryEntry[],
    private readonly failOnInsert: boolean = false
  ) {}

  async query(text: string, values?: unknown[]): Promise<{ rows: unknown[] }> {
    this.log.push({ text, values });
    if (this.failOnInsert && text.trimStart().toUpperCase().startsWith("INSERT")) {
      throw new Error("Simulated DB error");
    }
    return { rows: [] };
  }

  release(): void {
    // no-op
  }
}

class MockPool {
  readonly log: QueryEntry[] = [];
  private tableRows = new Map<string, unknown[]>([
    ["users", []],
    ["posts", []],
    ["reports", []],
    ["appeals", []]
  ]);
  private _shouldFailQuery = false;
  private _failClientInsert = false;

  setRows(table: string, rows: unknown[]): this {
    this.tableRows.set(table, rows);
    return this;
  }

  setFailQuery(fail: boolean): this {
    this._shouldFailQuery = fail;
    return this;
  }

  setFailClientInsert(fail: boolean): this {
    this._failClientInsert = fail;
    return this;
  }

  async query(text: string, values?: unknown[]): Promise<{ rows: unknown[] }> {
    this.log.push({ text, values });
    if (this._shouldFailQuery) {
      throw new Error("Mock Postgres error");
    }
    return { rows: this.rowsForQuery(text) };
  }

  async connect(): Promise<MockClient> {
    return new MockClient(this.log, this._failClientInsert);
  }

  private rowsForQuery(text: string): unknown[] {
    const t = text.toLowerCase();
    if (t.includes("from users")) return this.tableRows.get("users") ?? [];
    if (t.includes("from posts")) return this.tableRows.get("posts") ?? [];
    if (t.includes("from reports")) return this.tableRows.get("reports") ?? [];
    if (t.includes("from appeals")) return this.tableRows.get("appeals") ?? [];
    return [];
  }
}

function makePool(): MockPool {
  return new MockPool();
}

function castPool(mock: MockPool): Pool {
  return mock as unknown as Pool;
}

// ── Domain fixtures ───────────────────────────────────────────────────────────

function makeUser(overrides: Partial<IdentityProfile> = {}): IdentityProfile {
  return {
    id: "usr_1",
    handle: "alice",
    displayName: "Alice",
    role: "member",
    governanceAcceptedAt: "2026-01-01T00:00:00.000Z",
    humanVerifiedAt: "2026-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: "pst_1",
    authorId: "usr_1",
    body: "Hello world",
    createdAt: "2026-01-01T00:10:00.000Z",
    ...overrides
  };
}

function makeReport(overrides: Partial<Report> = {}): Report {
  return {
    id: "rpt_1",
    postId: "pst_1",
    reporterId: "usr_1",
    reason: "Off-topic",
    status: "open",
    createdAt: "2026-01-01T00:20:00.000Z",
    ...overrides
  };
}

function makeAppeal(overrides: Partial<Appeal> = {}): Appeal {
  return {
    id: "apl_1",
    reportId: "rpt_1",
    appellantId: "usr_1",
    reason: "Disagree",
    status: "open",
    createdAt: "2026-01-01T00:30:00.000Z",
    updatedAt: "2026-01-01T00:30:00.000Z",
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

// Postgres DB row fixtures (column names match postgres schema)
function makeUserRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "usr_1",
    handle: "alice",
    display_name: "Alice",
    role: "member",
    governance_accepted_at: "2026-01-01T00:00:00.000Z",
    human_verified_at: "2026-01-01T00:00:00.000Z",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    identity_assurance_level: null,
    identity_assurance_signals: null,
    identity_assurance_evaluated_at: null,
    ...overrides
  };
}

function makePostRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "pst_1",
    author_id: "usr_1",
    body: "Hello world",
    created_at: "2026-01-01T00:10:00.000Z",
    ...overrides
  };
}

function makeReportRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "rpt_1",
    post_id: "pst_1",
    reporter_id: "usr_1",
    reason: "Off-topic",
    status: "open",
    created_at: "2026-01-01T00:20:00.000Z",
    ...overrides
  };
}

function makeAppealRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "apl_1",
    report_id: "rpt_1",
    appellant_id: "usr_1",
    reason: "Disagree",
    status: "open",
    appealed_audit_record_id: null,
    created_at: "2026-01-01T00:30:00.000Z",
    updated_at: "2026-01-01T00:30:00.000Z",
    decided_at: null,
    decided_by_id: null,
    decision_rationale: null,
    ...overrides
  };
}

// ── initialize ────────────────────────────────────────────────────────────────

describe("PostgresStorageAdapter.initialize", () => {
  it("applies schema DDL via pool.query", async () => {
    const pool = makePool();
    const adapter = new PostgresStorageAdapter(castPool(pool));

    await adapter.initialize();

    assert.equal(pool.log.length, 1);
    const sql = pool.log[0]?.text ?? "";
    assert.ok(sql.includes("CREATE TABLE IF NOT EXISTS users"), "creates users table");
    assert.ok(sql.includes("CREATE TABLE IF NOT EXISTS posts"), "creates posts table");
    assert.ok(sql.includes("CREATE TABLE IF NOT EXISTS reports"), "creates reports table");
    assert.ok(sql.includes("CREATE TABLE IF NOT EXISTS appeals"), "creates appeals table");
  });

  it("is idempotent — safe to call multiple times", async () => {
    const pool = makePool();
    const adapter = new PostgresStorageAdapter(castPool(pool));

    await adapter.initialize();
    await adapter.initialize();

    // Each call issues one query; no errors
    assert.equal(pool.log.length, 2);
  });
});

// ── loadAll ───────────────────────────────────────────────────────────────────

describe("PostgresStorageAdapter.loadAll", () => {
  it("returns empty store when all tables return no rows", async () => {
    const pool = makePool();
    const adapter = new PostgresStorageAdapter(castPool(pool));

    const store = await adapter.loadAll();

    assert.deepEqual(store, { users: [], posts: [], reports: [], appeals: [] });
  });

  it("maps user row columns to IdentityProfile fields", async () => {
    const pool = makePool();
    pool.setRows("users", [makeUserRow({ handle: "alice", role: "moderator" })]);
    const adapter = new PostgresStorageAdapter(castPool(pool));

    const { users } = await adapter.loadAll();

    assert.equal(users.length, 1);
    assert.equal(users[0]?.id, "usr_1");
    assert.equal(users[0]?.handle, "alice");
    assert.equal(users[0]?.displayName, "Alice");
    assert.equal(users[0]?.role, "moderator");
    assert.equal(users[0]?.governanceAcceptedAt, "2026-01-01T00:00:00.000Z");
    assert.equal(users[0]?.humanVerifiedAt, "2026-01-01T00:00:00.000Z");
  });

  it("maps identity assurance fields from JSONB columns", async () => {
    const pool = makePool();
    // JSONB is auto-parsed by pg → signals is already a JS array
    pool.setRows("users", [
      makeUserRow({
        identity_assurance_level: "enhanced",
        identity_assurance_signals: ["attestation", "governance_commitment"],
        identity_assurance_evaluated_at: "2026-01-01T00:00:05.000Z"
      })
    ]);
    const adapter = new PostgresStorageAdapter(castPool(pool));

    const { users } = await adapter.loadAll();
    const user = users[0];

    assert.ok(user);
    assert.equal(user.identityAssuranceLevel, "enhanced");
    assert.deepEqual(user.identityAssuranceSignals, ["attestation", "governance_commitment"]);
    assert.equal(user.identityAssuranceEvaluatedAt, "2026-01-01T00:00:05.000Z");
  });

  it("omits assurance fields when DB columns are null", async () => {
    const pool = makePool();
    pool.setRows("users", [
      makeUserRow({
        identity_assurance_level: null,
        identity_assurance_signals: null,
        identity_assurance_evaluated_at: null
      })
    ]);
    const adapter = new PostgresStorageAdapter(castPool(pool));

    const { users } = await adapter.loadAll();
    const user = users[0];

    assert.ok(user);
    assert.equal(user.identityAssuranceLevel, undefined);
    assert.equal(user.identityAssuranceSignals, undefined);
    assert.equal(user.identityAssuranceEvaluatedAt, undefined);
  });

  it("filters unknown assurance signals from JSONB values", async () => {
    const pool = makePool();
    pool.setRows("users", [
      makeUserRow({
        identity_assurance_level: "attested",
        // mix of valid and invalid signals
        identity_assurance_signals: ["attestation", "INVALID_SIGNAL", "governance_commitment"]
      })
    ]);
    const adapter = new PostgresStorageAdapter(castPool(pool));

    const { users } = await adapter.loadAll();
    assert.deepEqual(users[0]?.identityAssuranceSignals, ["attestation", "governance_commitment"]);
  });

  it("maps post row columns to Post fields", async () => {
    const pool = makePool();
    pool.setRows("posts", [makePostRow({ body: "My first post" })]);
    const adapter = new PostgresStorageAdapter(castPool(pool));

    const { posts } = await adapter.loadAll();

    assert.equal(posts.length, 1);
    assert.equal(posts[0]?.id, "pst_1");
    assert.equal(posts[0]?.authorId, "usr_1");
    assert.equal(posts[0]?.body, "My first post");
  });

  it("maps report row columns to Report fields", async () => {
    const pool = makePool();
    pool.setRows("reports", [makeReportRow({ status: "triaged" })]);
    const adapter = new PostgresStorageAdapter(castPool(pool));

    const { reports } = await adapter.loadAll();

    assert.equal(reports.length, 1);
    assert.equal(reports[0]?.id, "rpt_1");
    assert.equal(reports[0]?.postId, "pst_1");
    assert.equal(reports[0]?.reporterId, "usr_1");
    assert.equal(reports[0]?.status, "triaged");
  });

  it("maps appeal row columns to Appeal fields including optional columns", async () => {
    const pool = makePool();
    pool.setRows("appeals", [
      makeAppealRow({
        status: "granted",
        appealed_audit_record_id: "rec_123",
        decided_at: "2026-01-10T00:00:00.000Z",
        decided_by_id: "usr_mod",
        decision_rationale: "Granted on review"
      })
    ]);
    const adapter = new PostgresStorageAdapter(castPool(pool));

    const { appeals } = await adapter.loadAll();
    const appeal = appeals[0];

    assert.ok(appeal);
    assert.equal(appeal.status, "granted");
    assert.equal(appeal.appealedAuditRecordId, "rec_123");
    assert.equal(appeal.decidedAt, "2026-01-10T00:00:00.000Z");
    assert.equal(appeal.decidedById, "usr_mod");
    assert.equal(appeal.decisionRationale, "Granted on review");
  });

  it("omits undefined optional Appeal fields when DB columns are null", async () => {
    const pool = makePool();
    pool.setRows("appeals", [makeAppealRow()]);
    const adapter = new PostgresStorageAdapter(castPool(pool));

    const { appeals } = await adapter.loadAll();
    const appeal = appeals[0];

    assert.ok(appeal);
    assert.equal(appeal.appealedAuditRecordId, undefined);
    assert.equal(appeal.decidedAt, undefined);
    assert.equal(appeal.decidedById, undefined);
    assert.equal(appeal.decisionRationale, undefined);
  });

  it("issues parallel SELECT queries for all four entity types", async () => {
    const pool = makePool();
    const adapter = new PostgresStorageAdapter(castPool(pool));

    await adapter.loadAll();

    const selects = pool.log.filter((e) => e.text.toUpperCase().startsWith("SELECT"));
    assert.equal(selects.length, 4);
    const tables = selects.map((e) => {
      const m = e.text.match(/FROM\s+(\w+)/i);
      return m?.[1] ?? "";
    });
    assert.ok(tables.includes("users"), "queries users");
    assert.ok(tables.includes("posts"), "queries posts");
    assert.ok(tables.includes("reports"), "queries reports");
    assert.ok(tables.includes("appeals"), "queries appeals");
  });
});

// ── flush ─────────────────────────────────────────────────────────────────────

describe("PostgresStorageAdapter.flush", () => {
  it("wraps all operations in a BEGIN / COMMIT transaction", async () => {
    const pool = makePool();
    const adapter = new PostgresStorageAdapter(castPool(pool));

    await adapter.flush({ users: [], posts: [], reports: [], appeals: [] });

    const texts = pool.log.map((e) => e.text);
    assert.ok(texts.includes("BEGIN"), "issues BEGIN");
    assert.ok(texts.includes("COMMIT"), "issues COMMIT");
    assert.ok(!texts.includes("ROLLBACK"), "no ROLLBACK on success");
  });

  it("deletes entities in FK-safe order (appeals → reports → posts → users)", async () => {
    const pool = makePool();
    const adapter = new PostgresStorageAdapter(castPool(pool));

    await adapter.flush({ users: [], posts: [], reports: [], appeals: [] });

    const deleteTexts = pool.log
      .filter((e) => e.text.toUpperCase().startsWith("DELETE"))
      .map((e) => e.text.toLowerCase());

    const appealsIdx = deleteTexts.findIndex((t) => t.includes("appeals"));
    const reportsIdx = deleteTexts.findIndex((t) => t.includes("reports"));
    const postsIdx = deleteTexts.findIndex((t) => t.includes("posts"));
    const usersIdx = deleteTexts.findIndex((t) => t.includes("users"));

    assert.ok(appealsIdx !== -1, "deletes from appeals");
    assert.ok(reportsIdx !== -1, "deletes from reports");
    assert.ok(postsIdx !== -1, "deletes from posts");
    assert.ok(usersIdx !== -1, "deletes from users");
    assert.ok(appealsIdx < reportsIdx, "appeals deleted before reports");
    assert.ok(reportsIdx < postsIdx, "reports deleted before posts");
    assert.ok(postsIdx < usersIdx, "posts deleted before users");
  });

  it("upserts entities in FK-safe order (users → posts → reports → appeals)", async () => {
    const pool = makePool();
    const adapter = new PostgresStorageAdapter(castPool(pool));

    await adapter.flush(buildStore());

    const insertTexts = pool.log
      .filter((e) => e.text.toUpperCase().startsWith("INSERT"))
      .map((e) => e.text.toLowerCase());

    const usersIdx = insertTexts.findIndex((t) => t.includes("into users"));
    const postsIdx = insertTexts.findIndex((t) => t.includes("into posts"));
    const reportsIdx = insertTexts.findIndex((t) => t.includes("into reports"));
    const appealsIdx = insertTexts.findIndex((t) => t.includes("into appeals"));

    assert.ok(usersIdx < postsIdx, "users upserted before posts");
    assert.ok(postsIdx < reportsIdx, "posts upserted before reports");
    assert.ok(reportsIdx < appealsIdx, "reports upserted before appeals");
  });

  it("uses ON CONFLICT (id) DO UPDATE for upsert semantics", async () => {
    const pool = makePool();
    const adapter = new PostgresStorageAdapter(castPool(pool));

    await adapter.flush(buildStore());

    const inserts = pool.log.filter((e) => e.text.toUpperCase().startsWith("INSERT"));
    for (const entry of inserts) {
      assert.ok(
        entry.text.toUpperCase().includes("ON CONFLICT"),
        `INSERT lacks ON CONFLICT: ${entry.text.slice(0, 60)}`
      );
    }
  });

  it("passes keepIds array to DELETE via parameterized query", async () => {
    const pool = makePool();
    const adapter = new PostgresStorageAdapter(castPool(pool));

    await adapter.flush({ users: [makeUser({ id: "usr_a" })], posts: [], reports: [], appeals: [] });

    const userDelete = pool.log.find(
      (e) => e.text.toUpperCase().startsWith("DELETE") && e.text.toLowerCase().includes("users")
    );
    assert.ok(userDelete, "has DELETE FROM users");
    assert.deepEqual(userDelete.values, [["usr_a"]]);
  });

  it("persists identity assurance fields as JSON string parameter", async () => {
    const pool = makePool();
    const adapter = new PostgresStorageAdapter(castPool(pool));

    const user = makeUser({
      identityAssuranceLevel: "enhanced",
      identityAssuranceSignals: ["attestation", "governance_commitment"],
      identityAssuranceEvaluatedAt: "2026-01-01T00:00:05.000Z"
    });

    await adapter.flush({ users: [user], posts: [], reports: [], appeals: [] });

    const userInsert = pool.log.find(
      (e) => e.text.toUpperCase().startsWith("INSERT") && e.text.toLowerCase().includes("into users")
    );
    assert.ok(userInsert, "has INSERT INTO users");
    const values = userInsert.values as unknown[];
    // $9 → identity_assurance_level, $10 → identity_assurance_signals (JSON string), $11 → evaluated_at
    assert.equal(values[8], "enhanced");
    assert.equal(values[9], JSON.stringify(["attestation", "governance_commitment"]));
    assert.equal(values[10], "2026-01-01T00:00:05.000Z");
  });

  it("sends null for missing optional user assurance fields", async () => {
    const pool = makePool();
    const adapter = new PostgresStorageAdapter(castPool(pool));

    await adapter.flush({ users: [makeUser()], posts: [], reports: [], appeals: [] });

    const userInsert = pool.log.find(
      (e) => e.text.toUpperCase().startsWith("INSERT") && e.text.toLowerCase().includes("into users")
    );
    assert.ok(userInsert);
    const values = userInsert.values as unknown[];
    assert.equal(values[8], null); // identity_assurance_level
    assert.equal(values[9], null); // identity_assurance_signals
    assert.equal(values[10], null); // identity_assurance_evaluated_at
  });

  it("sends null for optional Appeal fields when undefined", async () => {
    const pool = makePool();
    const adapter = new PostgresStorageAdapter(castPool(pool));

    const appeal = makeAppeal(); // no optional fields
    await adapter.flush({ users: [], posts: [], reports: [], appeals: [appeal] });

    const appealInsert = pool.log.find(
      (e) => e.text.toUpperCase().startsWith("INSERT") && e.text.toLowerCase().includes("into appeals")
    );
    assert.ok(appealInsert);
    const values = appealInsert.values as unknown[];
    // $6=appealed_audit_record_id, $9=decided_at, $10=decided_by_id, $11=decision_rationale
    assert.equal(values[5], null);
    assert.equal(values[8], null);
    assert.equal(values[9], null);
    assert.equal(values[10], null);
  });

  it("issues ROLLBACK and re-throws on client error", async () => {
    const pool = makePool();
    pool.setFailClientInsert(true);

    const adapter = new PostgresStorageAdapter(castPool(pool));

    await assert.rejects(
      () => adapter.flush({ users: [makeUser()], posts: [], reports: [], appeals: [] }),
      /Simulated DB error/
    );

    const texts = pool.log.map((e) => e.text);
    assert.ok(texts.includes("ROLLBACK"), "ROLLBACK issued on error");
    assert.ok(!texts.includes("COMMIT"), "COMMIT NOT issued on error");
  });

  it("handles empty store flush without errors", async () => {
    const pool = makePool();
    const adapter = new PostgresStorageAdapter(castPool(pool));

    await adapter.flush({ users: [], posts: [], reports: [], appeals: [] });

    // Should complete without throwing
    const texts = pool.log.map((e) => e.text);
    assert.ok(texts.includes("COMMIT"));
  });
});

// ── healthCheck ───────────────────────────────────────────────────────────────

describe("PostgresStorageAdapter.healthCheck", () => {
  it("returns healthy when pool query succeeds", async () => {
    const pool = makePool();
    const adapter = new PostgresStorageAdapter(castPool(pool));

    const health = await adapter.healthCheck();

    assert.equal(health.backend, "postgres");
    assert.equal(health.healthy, true);
    assert.ok(health.detail.toLowerCase().includes("reachable"));
  });

  it("returns unhealthy when pool query throws", async () => {
    const pool = makePool();
    pool.setFailQuery(true);
    const adapter = new PostgresStorageAdapter(castPool(pool));

    const health = await adapter.healthCheck();

    assert.equal(health.backend, "postgres");
    assert.equal(health.healthy, false);
    assert.ok(health.detail.toLowerCase().includes("error"));
    assert.ok(health.detail.includes("Mock Postgres error"));
  });

  it("issues a SELECT 1 ping for the health check", async () => {
    const pool = makePool();
    const adapter = new PostgresStorageAdapter(castPool(pool));

    await adapter.healthCheck();

    assert.ok(pool.log.some((e) => e.text.trim() === "SELECT 1"));
  });
});
