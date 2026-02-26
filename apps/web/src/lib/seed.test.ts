import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applySeedSnapshot,
  createDefaultSeedSnapshot,
  parseSeedSnapshot,
  SeedValidationError,
  type SeedableStore
} from "./seed";

function buildEmptyStore(): SeedableStore {
  return {
    users: [],
    posts: [],
    reports: []
  };
}

describe("createDefaultSeedSnapshot", () => {
  it("creates governance-asserted, linked seed fixtures", () => {
    const snapshot = createDefaultSeedSnapshot("2026-02-01T10:00:00.000Z");

    assert.equal(snapshot.version, 1);
    assert.equal(snapshot.governance.humanExpressionOnly, true);
    assert.equal(snapshot.users.length, 4);
    assert.equal(snapshot.posts.length, 3);
    assert.equal(snapshot.reports.length, 3);
  });
});

describe("parseSeedSnapshot", () => {
  it("rejects reports that reference unknown posts", () => {
    const snapshot = createDefaultSeedSnapshot();
    snapshot.reports[0].postId = "missing_post";

    assert.throws(
      () => parseSeedSnapshot(snapshot),
      (error) => error instanceof SeedValidationError && error.code === "UNKNOWN_REPORT_POST"
    );
  });

  it("rejects governance assertions that are not explicitly true", () => {
    const snapshot = createDefaultSeedSnapshot();
    const payload = {
      ...snapshot,
      governance: {
        ...snapshot.governance,
        auditabilityRequired: false
      }
    };

    assert.throws(
      () => parseSeedSnapshot(payload),
      (error) => error instanceof SeedValidationError && error.code === "INVALID_GOVERNANCE_ASSERTION"
    );
  });
});

describe("applySeedSnapshot", () => {
  it("replaces store arrays with validated seed data", () => {
    const store = buildEmptyStore();
    const snapshot = createDefaultSeedSnapshot("2026-02-10T00:00:00.000Z");

    const summary = applySeedSnapshot(store, snapshot);

    assert.deepEqual(summary, {
      users: 4,
      posts: 3,
      reports: 3
    });

    assert.equal(store.users[0]?.handle, "chief_admin");
    assert.equal(store.posts[0]?.authorId, "usr_human_author");
    assert.equal(store.reports[0]?.status, "open");
  });
});
