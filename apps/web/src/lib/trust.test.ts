import test from "node:test";
import assert from "node:assert/strict";
import { computeTrustScore } from "@/lib/trust";

test("computeTrustScore returns baseline for quiet user", () => {
  const score = computeTrustScore(
    {
      users: [],
      posts: [],
      reports: []
    },
    "user-1",
    "2026-02-26T00:00:00.000Z"
  );

  assert.equal(score.score, 50);
  assert.equal(score.tier, "steady");
  assert.equal(score.rationale[0]?.code, "BASELINE");
});

test("computeTrustScore rewards contribution and penalizes open reports", () => {
  const score = computeTrustScore(
    {
      users: [],
      posts: [
        { id: "p1", authorId: "user-1", body: "A", createdAt: "2026-02-01T00:00:00.000Z" },
        { id: "p2", authorId: "user-1", body: "B", createdAt: "2026-02-02T00:00:00.000Z" }
      ],
      reports: [
        {
          id: "r1",
          postId: "p1",
          reporterId: "other",
          reason: "spam",
          status: "open",
          createdAt: "2026-02-03T00:00:00.000Z"
        }
      ]
    },
    "user-1",
    "2026-02-26T00:00:00.000Z"
  );

  assert.equal(score.score, 44);
  assert.equal(score.tier, "watch");
});
