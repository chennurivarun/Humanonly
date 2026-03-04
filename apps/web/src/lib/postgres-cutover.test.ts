import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  collectStoreIntegrityViolations,
  countStoreEntities,
  evaluateCutoverParity,
  storeFingerprint
} from "@/lib/postgres-cutover";
import type { GovernedStore } from "@/lib/governed-store";

function makeStore(): GovernedStore {
  return {
    users: [
      {
        id: "usr_1",
        handle: "alice",
        displayName: "Alice",
        role: "member",
        governanceAcceptedAt: "2026-01-01T00:00:00.000Z",
        humanVerifiedAt: "2026-01-01T00:00:00.000Z",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        identityAssuranceLevel: "enhanced",
        identityAssuranceSignals: ["governance_commitment", "attestation"],
        identityAssuranceEvaluatedAt: "2026-01-01T00:00:05.000Z"
      }
    ],
    posts: [
      {
        id: "pst_1",
        authorId: "usr_1",
        body: "hello",
        createdAt: "2026-01-01T01:00:00.000Z"
      }
    ],
    reports: [
      {
        id: "rpt_1",
        postId: "pst_1",
        reporterId: "usr_1",
        reason: "spam",
        status: "open",
        createdAt: "2026-01-01T01:05:00.000Z"
      }
    ],
    appeals: [
      {
        id: "apl_1",
        reportId: "rpt_1",
        appellantId: "usr_1",
        reason: "please review",
        status: "open",
        createdAt: "2026-01-01T01:10:00.000Z",
        updatedAt: "2026-01-01T01:10:00.000Z"
      }
    ]
  };
}

describe("postgres cutover helpers", () => {
  it("counts governed entities", () => {
    const counts = countStoreEntities(makeStore());
    assert.deepEqual(counts, { users: 1, posts: 1, reports: 1, appeals: 1 });
  });

  it("detects missing relational references", () => {
    const store = makeStore();
    store.reports[0]!.postId = "missing-post";
    store.appeals[0]!.appellantId = "missing-user";

    const violations = collectStoreIntegrityViolations(store);
    assert.equal(violations.length, 2);
    assert.deepEqual(violations[0], {
      entity: "reports",
      id: "rpt_1",
      relation: "postId",
      missingId: "missing-post"
    });
    assert.deepEqual(violations[1], {
      entity: "appeals",
      id: "apl_1",
      relation: "appellantId",
      missingId: "missing-user"
    });
  });

  it("produces stable fingerprints regardless of row order", () => {
    const source = makeStore();
    const reordered = makeStore();

    reordered.users = [...reordered.users].reverse();
    reordered.posts = [...reordered.posts].reverse();
    reordered.reports = [...reordered.reports].reverse();
    reordered.appeals = [...reordered.appeals].reverse();
    reordered.users[0]!.identityAssuranceSignals = ["attestation", "governance_commitment"];

    assert.equal(storeFingerprint(source), storeFingerprint(reordered));
  });

  it("evaluates parity for equal and non-equal stores", () => {
    const source = makeStore();
    const target = makeStore();

    const equalParity = evaluateCutoverParity(source, target);
    assert.equal(equalParity.countsMatch, true);
    assert.equal(equalParity.fingerprintMatch, true);

    target.posts[0]!.body = "changed";
    const diffParity = evaluateCutoverParity(source, target);
    assert.equal(diffParity.countsMatch, true);
    assert.equal(diffParity.fingerprintMatch, false);
  });
});
