import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { buildModerationInsights } from "./insights";
import type { Appeal, IdentityProfile, Post, Report } from "@/lib/store";

describe("buildModerationInsights", () => {
  it("builds role-aware queue, trend, trust, and action-log summaries", async () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), "humanonly-insights-"));
    process.env.HUMANONLY_AUDIT_LOG_FILE = path.join(tempDir, "audit.jsonl");

    const { resetAuditStateForTests, writeAuditStub } = await import("@/lib/audit");
    resetAuditStateForTests();

    await writeAuditStub({
      actorId: "usr_mod",
      action: "reports.queue.requested",
      targetType: "moderation_queue",
      metadata: { role: "moderator" },
      createdAt: "2026-02-25T00:00:00.000Z"
    });

    await writeAuditStub({
      actorId: "usr_mod",
      action: "appeals.queue.requested",
      targetType: "appeal",
      metadata: { role: "moderator" },
      createdAt: "2026-02-26T00:00:00.000Z"
    });

    const users: IdentityProfile[] = [
      {
        id: "usr_mod",
        handle: "queue_mod",
        displayName: "Queue Moderator",
        role: "moderator",
        governanceAcceptedAt: "2026-02-01T00:00:00.000Z",
        humanVerifiedAt: "2026-02-01T00:00:00.000Z",
        createdAt: "2026-02-01T00:00:00.000Z",
        updatedAt: "2026-02-01T00:00:00.000Z"
      },
      {
        id: "usr_author",
        handle: "human_author",
        displayName: "Human Author",
        role: "member",
        governanceAcceptedAt: "2026-02-01T00:00:00.000Z",
        humanVerifiedAt: "2026-02-01T00:00:00.000Z",
        createdAt: "2026-02-01T00:00:00.000Z",
        updatedAt: "2026-02-01T00:00:00.000Z"
      },
      {
        id: "usr_reader",
        handle: "civic_reader",
        displayName: "Civic Reader",
        role: "member",
        governanceAcceptedAt: "2026-02-01T00:00:00.000Z",
        humanVerifiedAt: "2026-02-01T00:00:00.000Z",
        createdAt: "2026-02-01T00:00:00.000Z",
        updatedAt: "2026-02-01T00:00:00.000Z"
      }
    ];

    const posts: Post[] = [
      {
        id: "pst_1",
        authorId: "usr_author",
        body: "Human-only expression with transparent governance.",
        createdAt: "2026-02-25T05:00:00.000Z"
      }
    ];

    const reports: Report[] = [
      {
        id: "rpt_open",
        postId: "pst_1",
        reporterId: "usr_reader",
        reason: "Needs triage",
        status: "open",
        createdAt: "2026-02-26T06:00:00.000Z"
      },
      {
        id: "rpt_resolved",
        postId: "pst_1",
        reporterId: "usr_reader",
        reason: "Resolved for test",
        status: "resolved",
        createdAt: "2026-02-18T06:00:00.000Z"
      }
    ];

    const appeals: Appeal[] = [
      {
        id: "apl_open",
        reportId: "rpt_open",
        appellantId: "usr_author",
        reason: "Requesting review",
        status: "open",
        createdAt: "2026-02-26T08:00:00.000Z",
        updatedAt: "2026-02-26T08:00:00.000Z"
      },
      {
        id: "apl_granted",
        reportId: "rpt_resolved",
        appellantId: "usr_author",
        reason: "Resolved appeal",
        status: "granted",
        createdAt: "2026-02-18T10:00:00.000Z",
        updatedAt: "2026-02-18T13:00:00.000Z",
        decidedAt: "2026-02-18T13:00:00.000Z",
        decidedById: "usr_mod",
        decisionRationale: "Human review"
      }
    ];

    const insights = buildModerationInsights(
      {
        users,
        posts,
        reports,
        appeals
      },
      {
        nowIso: "2026-02-27T00:00:00.000Z",
        trendWindowsDays: [7, 30],
        queueLimit: 10,
        trustWatchlistLimit: 3,
        actionLogLimit: 5
      }
    );

    assert.equal(insights.queueHealth.openReports, 1);
    assert.equal(insights.queueHealth.triagedReports, 0);
    assert.equal(insights.queueHealth.openAppeals, 1);
    assert.equal(insights.reports.length, 1);
    assert.equal(insights.reports[0]?.reporter?.handle, "civic_reader");
    assert.equal(insights.reports[0]?.author?.handle, "human_author");
    assert.equal(insights.reports[0]?.reporterTrust?.tier, "steady");
    assert.equal(insights.appeals.length, 1);
    assert.equal(insights.appeals[0]?.appellant?.handle, "human_author");
    assert.equal(insights.recentActionLog.chain.valid, true);
    assert.equal(insights.recentActionLog.entries.length, 2);

    const trend7d = insights.trends.find((trend) => trend.windowDays === 7);
    assert.ok(trend7d);
    assert.equal(trend7d?.reportsCreated, 1);
    assert.equal(trend7d?.reportsResolved, 0);
    assert.equal(trend7d?.appealsCreated, 1);
    assert.equal(trend7d?.appealsResolved, 0);

    const trend30d = insights.trends.find((trend) => trend.windowDays === 30);
    assert.ok(trend30d);
    assert.equal(trend30d?.reportsCreated, 2);
    assert.equal(trend30d?.reportsResolved, 1);
    assert.equal(trend30d?.appealsResolved, 1);
    assert.equal(trend30d?.medianAppealResolutionHours, 3);

    assert.equal(insights.trustWatchlist.length, 3);
    assert.equal(insights.trustWatchlist[0]?.trust.score <= insights.trustWatchlist[1]?.trust.score, true);
  });
});
