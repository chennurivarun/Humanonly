import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { buildModerationCockpit } from "@/lib/moderation/cockpit";
import type { Appeal, IdentityProfile, Post, Report } from "@/lib/store";

describe("buildModerationCockpit", () => {
  it("prioritizes risk + SLA pressure and exposes latest handoff context", async () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), "humanonly-cockpit-"));
    process.env.HUMANONLY_AUDIT_LOG_FILE = path.join(tempDir, "audit.jsonl");

    const { resetAuditStateForTests, writeAuditStub } = await import("@/lib/audit");
    resetAuditStateForTests();

    await writeAuditStub({
      actorId: "usr_mod",
      action: "moderation.handoff.recorded",
      targetType: "moderation_queue",
      targetId: "rpt_high",
      metadata: {
        targetType: "report",
        targetId: "rpt_high",
        action: "triage",
        templateId: "triage_intake",
        previousStatus: "open",
        nextStatus: "triaged",
        reportId: "rpt_high"
      },
      createdAt: "2026-03-01T00:00:00.000Z"
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
        handle: "author",
        displayName: "Author",
        role: "member",
        governanceAcceptedAt: "2026-02-01T00:00:00.000Z",
        humanVerifiedAt: "2026-02-01T00:00:00.000Z",
        createdAt: "2026-02-01T00:00:00.000Z",
        updatedAt: "2026-02-01T00:00:00.000Z"
      },
      {
        id: "usr_reporter",
        handle: "reporter",
        displayName: "Reporter",
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
        body: "Human authored content that triggered a review.",
        createdAt: "2026-02-27T00:00:00.000Z"
      }
    ];

    const reports: Report[] = [
      {
        id: "rpt_high",
        postId: "pst_1",
        reporterId: "usr_reporter",
        reason: "Potential policy harm requiring immediate triage",
        status: "open",
        createdAt: "2026-03-02T00:00:00.000Z"
      },
      {
        id: "rpt_low",
        postId: "pst_1",
        reporterId: "usr_reporter",
        reason: "Routine review",
        status: "triaged",
        createdAt: "2026-03-03T09:30:00.000Z"
      }
    ];

    const appeals: Appeal[] = [
      {
        id: "apl_1",
        reportId: "rpt_high",
        appellantId: "usr_author",
        reason: "Need context reviewed",
        status: "open",
        createdAt: "2026-03-03T03:00:00.000Z",
        updatedAt: "2026-03-03T03:00:00.000Z"
      }
    ];

    const snapshot = buildModerationCockpit(
      {
        users,
        posts,
        reports,
        appeals
      },
      {
        nowIso: "2026-03-03T10:00:00.000Z",
        limit: 10
      }
    );

    assert.equal(snapshot.summary.totalCandidates, 3);
    assert.equal(snapshot.summary.returnedItems, 3);
    assert.equal(snapshot.summary.reportQueue.open, 1);
    assert.equal(snapshot.summary.sla.breachedTotal >= 1, true);

    const first = snapshot.queue[0];
    assert.equal(first?.id, "rpt_high");
    assert.equal(first?.sla.breached, true);
    assert.equal(first?.latestHandoff?.templateId, "triage_intake");

    const filtered = buildModerationCockpit(
      {
        users,
        posts,
        reports,
        appeals
      },
      {
        nowIso: "2026-03-03T10:00:00.000Z",
        queue: "report",
        statuses: ["open"],
        minAgeHours: 5,
        riskTiers: ["steady", "watch", "restricted"]
      }
    );

    assert.equal(filtered.queue.length, 1);
    assert.equal(filtered.queue[0]?.queueType, "report");
    assert.equal(filtered.queue[0]?.status, "open");
  });
});
