import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildAdminMetrics } from "./metrics";

describe("buildAdminMetrics", () => {
  it("summarizes reports, appeals, trust, and override metrics", () => {
    const metrics = buildAdminMetrics(
      {
        users: [
          {
            id: "usr_1",
            handle: "alpha",
            displayName: "Alpha",
            role: "member",
            governanceAcceptedAt: "2026-02-01T00:00:00.000Z",
            humanVerifiedAt: "2026-02-01T00:00:00.000Z",
            createdAt: "2026-02-01T00:00:00.000Z",
            updatedAt: "2026-02-01T00:00:00.000Z"
          },
          {
            id: "usr_2",
            handle: "beta",
            displayName: "Beta",
            role: "member",
            governanceAcceptedAt: "2026-02-01T00:00:00.000Z",
            humanVerifiedAt: "2026-02-01T00:00:00.000Z",
            createdAt: "2026-02-01T00:00:00.000Z",
            updatedAt: "2026-02-01T00:00:00.000Z"
          }
        ],
        posts: [
          { id: "pst_1", authorId: "usr_1", body: "One", createdAt: "2026-02-01T00:10:00.000Z" },
          { id: "pst_2", authorId: "usr_1", body: "Two", createdAt: "2026-02-01T00:20:00.000Z" }
        ],
        reports: [
          {
            id: "rpt_1",
            postId: "pst_1",
            reporterId: "usr_2",
            reason: "Concern",
            status: "open",
            createdAt: "2026-02-01T01:00:00.000Z"
          },
          {
            id: "rpt_2",
            postId: "pst_2",
            reporterId: "usr_2",
            reason: "Concern",
            status: "resolved",
            createdAt: "2026-02-01T02:00:00.000Z"
          }
        ],
        appeals: [
          {
            id: "apl_1",
            reportId: "rpt_2",
            appellantId: "usr_1",
            reason: "Please review",
            status: "granted",
            createdAt: "2026-02-01T03:00:00.000Z",
            updatedAt: "2026-02-01T05:00:00.000Z",
            decidedAt: "2026-02-01T05:00:00.000Z"
          }
        ]
      },
      "2026-02-01T06:00:00.000Z"
    );

    assert.equal(metrics.reports.total, 2);
    assert.equal(metrics.reports.resolved, 1);
    assert.equal(metrics.reports.queueThroughputPercent, 50);
    assert.equal(metrics.appeals.medianResolutionHours, 2);
    assert.equal(metrics.appeals.granted, 1);
    assert.equal(metrics.overrides.total, 1);
    assert.equal(metrics.overrides.overrideRatePercent, 50);
    assert.equal(metrics.trust.averageScore > 0, true);
  });
});
