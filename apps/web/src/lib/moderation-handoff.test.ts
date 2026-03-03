import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Appeal, Report } from "@/lib/store";
import {
  applyModerationHandoff,
  ModerationHandoffValidationError,
  parseModerationHandoffPayload
} from "@/lib/moderation/handoff";

type TestStore = {
  reports: Report[];
  appeals: Appeal[];
};

function createStore(): TestStore {
  return {
    reports: [
      {
        id: "rpt_1",
        postId: "pst_1",
        reporterId: "usr_reporter",
        reason: "Queue item",
        status: "open",
        createdAt: "2026-03-02T00:00:00.000Z"
      }
    ],
    appeals: [
      {
        id: "apl_1",
        reportId: "rpt_1",
        appellantId: "usr_author",
        reason: "Please review",
        status: "open",
        createdAt: "2026-03-02T01:00:00.000Z",
        updatedAt: "2026-03-02T01:00:00.000Z"
      }
    ]
  };
}

describe("parseModerationHandoffPayload", () => {
  it("normalizes a valid escalate payload", () => {
    const command = parseModerationHandoffPayload({
      action: "escalate",
      targetType: "report",
      targetId: " rpt_1 ",
      templateId: "escalate_policy",
      humanConfirmed: true
    });

    assert.equal(command.targetId, "rpt_1");
    assert.equal(command.handoffToRole, "admin");
  });

  it("requires explicit human confirmation", () => {
    assert.throws(
      () =>
        parseModerationHandoffPayload({
          action: "triage",
          targetType: "report",
          targetId: "rpt_1",
          templateId: "triage_intake",
          humanConfirmed: false
        }),
      (error) => error instanceof ModerationHandoffValidationError && error.code === "HUMAN_CONFIRMATION_REQUIRED"
    );
  });

  it("rejects template/action mismatches", () => {
    assert.throws(
      () =>
        parseModerationHandoffPayload({
          action: "triage",
          targetType: "appeal",
          targetId: "apl_1",
          templateId: "resolve_note_context",
          humanConfirmed: true
        }),
      (error) => error instanceof ModerationHandoffValidationError && error.code === "TEMPLATE_ACTION_MISMATCH"
    );
  });
});

describe("applyModerationHandoff", () => {
  it("moves open reports and appeals into active handling during triage", () => {
    const store = createStore();

    const reportResult = applyModerationHandoff(
      store,
      parseModerationHandoffPayload({
        action: "triage",
        targetType: "report",
        targetId: "rpt_1",
        templateId: "triage_intake",
        note: "Initial review complete",
        humanConfirmed: true
      })
    );

    assert.equal(reportResult.statusChanged, true);
    assert.equal(reportResult.previousStatus, "open");
    assert.equal(reportResult.nextStatus, "triaged");
    assert.equal(store.reports[0]?.status, "triaged");

    const appealResult = applyModerationHandoff(
      store,
      parseModerationHandoffPayload({
        action: "triage",
        targetType: "appeal",
        targetId: "apl_1",
        templateId: "triage_intake",
        humanConfirmed: true
      })
    );

    assert.equal(appealResult.statusChanged, true);
    assert.equal(appealResult.nextStatus, "under_review");
    assert.equal(store.appeals[0]?.status, "under_review");
  });

  it("throws when target does not exist", () => {
    const store = createStore();

    assert.throws(
      () =>
        applyModerationHandoff(
          store,
          parseModerationHandoffPayload({
            action: "escalate",
            targetType: "report",
            targetId: "rpt_missing",
            templateId: "escalate_policy",
            humanConfirmed: true
          })
        ),
      (error) => error instanceof ModerationHandoffValidationError && error.code === "TARGET_NOT_FOUND"
    );
  });
});
