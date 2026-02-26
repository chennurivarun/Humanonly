import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
  createGovernedSnapshot,
  GOVERNANCE_ASSERTIONS,
  hydrateGovernedStoreFromFile,
  persistGovernedStoreToFile,
  type GovernedStore
} from "@/lib/governed-store";

function buildStore(): GovernedStore {
  return {
    users: [
      {
        id: "usr_1",
        handle: "founder",
        displayName: "Founder",
        role: "admin",
        governanceAcceptedAt: "2026-02-01T00:00:00.000Z",
        humanVerifiedAt: "2026-02-01T00:00:00.000Z",
        createdAt: "2026-02-01T00:00:00.000Z",
        updatedAt: "2026-02-01T00:00:00.000Z"
      }
    ],
    posts: [
      {
        id: "pst_1",
        authorId: "usr_1",
        body: "Human governance test post",
        createdAt: "2026-02-01T00:10:00.000Z"
      }
    ],
    reports: [
      {
        id: "rpt_1",
        postId: "pst_1",
        reporterId: "usr_1",
        reason: "Seed moderation report",
        status: "open",
        createdAt: "2026-02-01T00:20:00.000Z"
      }
    ],
    appeals: [
      {
        id: "apl_1",
        reportId: "rpt_1",
        appellantId: "usr_1",
        reason: "Need second review",
        status: "open",
        createdAt: "2026-02-01T00:30:00.000Z",
        updatedAt: "2026-02-01T00:30:00.000Z"
      }
    ]
  };
}

describe("governed store persistence", () => {
  it("creates snapshots that encode mandatory governance assertions", () => {
    const snapshot = createGovernedSnapshot(buildStore(), "2026-02-10T00:00:00.000Z");

    assert.deepEqual(snapshot.governance, GOVERNANCE_ASSERTIONS);
    assert.equal(snapshot.users.length, 1);
    assert.equal(snapshot.posts.length, 1);
    assert.equal(snapshot.reports.length, 1);
    assert.equal(snapshot.appeals.length, 1);
  });

  it("persists and rehydrates durable store snapshots", () => {
    const store = buildStore();
    const tempDir = mkdtempSync(path.join(tmpdir(), "humanonly-governed-store-"));
    const durablePath = path.join(tempDir, "store.json");

    const writtenPath = persistGovernedStoreToFile(store, durablePath, "2026-02-10T00:00:00.000Z");
    assert.equal(writtenPath, durablePath);

    const recovered: GovernedStore = {
      users: [],
      posts: [],
      reports: [],
      appeals: []
    };

    const summary = hydrateGovernedStoreFromFile(recovered, durablePath);

    assert.deepEqual(summary, {
      users: 1,
      posts: 1,
      reports: 1,
      appeals: 1
    });

    assert.equal(recovered.users[0]?.handle, "founder");
    assert.equal(recovered.posts[0]?.id, "pst_1");
    assert.equal(recovered.reports[0]?.status, "open");
    assert.equal(recovered.appeals[0]?.status, "open");
  });
});
