import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { buildModerationActionLog } from "./action-log";
import type { Appeal, IdentityProfile, Report } from "@/lib/store";

describe("buildModerationActionLog", () => {
  it("returns enriched moderation events from immutable audit history", async () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), "humanonly-action-log-"));
    process.env.HUMANONLY_AUDIT_LOG_FILE = path.join(tempDir, "audit.jsonl");

    const { resetAuditStateForTests, writeAuditStub } = await import("@/lib/audit");
    resetAuditStateForTests();

    await writeAuditStub({
      actorId: "usr_reporter",
      action: "report.created",
      targetType: "report",
      targetId: "rpt_1",
      metadata: { postId: "pst_1" },
      createdAt: "2026-02-01T00:00:00.000Z"
    });

    await writeAuditStub({
      actorId: "usr_reporter",
      action: "appeal.created",
      targetType: "appeal",
      targetId: "apl_1",
      metadata: { reportId: "rpt_1" },
      createdAt: "2026-02-01T00:01:00.000Z"
    });

    await writeAuditStub({
      actorId: "usr_mod",
      action: "appeal.reviewed",
      targetType: "appeal",
      targetId: "apl_1",
      metadata: { reportId: "rpt_1", decision: "grant" },
      createdAt: "2026-02-01T00:02:00.000Z"
    });

    const users: IdentityProfile[] = [
      {
        id: "usr_reporter",
        handle: "reporter",
        displayName: "Reporter",
        role: "member",
        governanceAcceptedAt: "2026-02-01T00:00:00.000Z",
        humanVerifiedAt: "2026-02-01T00:00:00.000Z",
        createdAt: "2026-02-01T00:00:00.000Z",
        updatedAt: "2026-02-01T00:00:00.000Z"
      },
      {
        id: "usr_mod",
        handle: "queue_mod",
        displayName: "Queue Mod",
        role: "moderator",
        governanceAcceptedAt: "2026-02-01T00:00:00.000Z",
        humanVerifiedAt: "2026-02-01T00:00:00.000Z",
        createdAt: "2026-02-01T00:00:00.000Z",
        updatedAt: "2026-02-01T00:00:00.000Z"
      }
    ];

    const reports: Report[] = [
      {
        id: "rpt_1",
        postId: "pst_1",
        reporterId: "usr_reporter",
        reason: "Policy concern",
        status: "triaged",
        createdAt: "2026-02-01T00:00:00.000Z"
      }
    ];

    const appeals: Appeal[] = [
      {
        id: "apl_1",
        reportId: "rpt_1",
        appellantId: "usr_reporter",
        reason: "Requesting review",
        status: "granted",
        createdAt: "2026-02-01T00:01:00.000Z",
        updatedAt: "2026-02-01T00:02:00.000Z",
        decidedAt: "2026-02-01T00:02:00.000Z",
        decidedById: "usr_mod",
        decisionRationale: "Human moderation review"
      }
    ];

    const log = buildModerationActionLog(
      {
        users,
        reports,
        appeals
      },
      {
        limit: 10,
        reportId: "rpt_1"
      }
    );

    assert.equal(log.chain.valid, true);
    assert.equal(log.entries.length, 3);
    assert.equal(log.entries[0]?.action, "appeal.reviewed");
    assert.equal(log.entries[0]?.actorHandle, "queue_mod");
    assert.equal(log.entries[0]?.appealStatus, "granted");
    assert.equal(log.entries[0]?.reportStatus, "triaged");
  });
});
