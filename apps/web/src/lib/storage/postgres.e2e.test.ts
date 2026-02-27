import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { Pool } from "pg";
import { PostgresStorageAdapter } from "@/lib/storage/postgres";
import type { GovernedStore } from "@/lib/governed-store";

function buildStore(): GovernedStore {
  return {
    users: [
      {
        id: "usr_e2e_admin",
        handle: "e2e_admin",
        displayName: "E2E Admin",
        role: "admin",
        governanceAcceptedAt: "2026-02-27T00:00:00.000Z",
        humanVerifiedAt: "2026-02-27T00:00:00.000Z",
        identityAssuranceLevel: "enhanced",
        identityAssuranceSignals: ["attestation", "governance_commitment", "interactive_challenge"],
        identityAssuranceEvaluatedAt: "2026-02-27T00:00:05.000Z",
        createdAt: "2026-02-27T00:00:00.000Z",
        updatedAt: "2026-02-27T00:00:00.000Z"
      }
    ],
    posts: [
      {
        id: "pst_e2e_1",
        authorId: "usr_e2e_admin",
        body: "Postgres e2e validation payload",
        createdAt: "2026-02-27T00:10:00.000Z"
      }
    ],
    reports: [
      {
        id: "rpt_e2e_1",
        postId: "pst_e2e_1",
        reporterId: "usr_e2e_admin",
        reason: "E2E validation report",
        status: "open",
        createdAt: "2026-02-27T00:20:00.000Z"
      }
    ],
    appeals: [
      {
        id: "apl_e2e_1",
        reportId: "rpt_e2e_1",
        appellantId: "usr_e2e_admin",
        reason: "E2E validation appeal",
        status: "under_review",
        appealedAuditRecordId: "rec_e2e_1",
        createdAt: "2026-02-27T00:30:00.000Z",
        updatedAt: "2026-02-27T00:35:00.000Z"
      }
    ]
  };
}

describe("PostgresStorageAdapter real-db e2e", { skip: process.env.HUMANONLY_POSTGRES_E2E !== "1" }, () => {
  let pool: Pool;
  let adapter: PostgresStorageAdapter;

  before(async () => {
    const connectionString = process.env.HUMANONLY_POSTGRES_URL;
    assert.ok(connectionString, "HUMANONLY_POSTGRES_URL must be set for Postgres e2e tests");

    pool = new Pool({ connectionString });
    adapter = new PostgresStorageAdapter(pool);

    await adapter.initialize();
    await adapter.flush({ users: [], posts: [], reports: [], appeals: [] });
  });

  after(async () => {
    await adapter.flush({ users: [], posts: [], reports: [], appeals: [] });
    await pool.end();
  });

  it("round-trips governed store using a real Postgres service", async () => {
    const store = buildStore();

    await adapter.flush(store);
    const loaded = await adapter.loadAll();

    assert.equal(loaded.users.length, 1);
    assert.equal(loaded.posts.length, 1);
    assert.equal(loaded.reports.length, 1);
    assert.equal(loaded.appeals.length, 1);

    assert.equal(loaded.users[0]?.handle, "e2e_admin");
    assert.equal(loaded.posts[0]?.body, "Postgres e2e validation payload");
    assert.equal(loaded.reports[0]?.status, "open");
    assert.equal(loaded.appeals[0]?.status, "under_review");
    assert.deepEqual(loaded.users[0]?.identityAssuranceSignals, [
      "attestation",
      "governance_commitment",
      "interactive_challenge"
    ]);
  });

  it("reports healthy when service connection is reachable", async () => {
    const health = await adapter.healthCheck();
    assert.equal(health.backend, "postgres");
    assert.equal(health.healthy, true);
  });
});
