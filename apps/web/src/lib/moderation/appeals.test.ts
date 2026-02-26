import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Appeal, IdentityProfile, Post, Report } from "@/lib/store";
import {
  AppealValidationError,
  applyAppealDecision,
  createAppealRecord,
  parseCreateAppealPayload,
  parseReviewAppealPayload
} from "./appeals";

type TestStore = {
  users: IdentityProfile[];
  posts: Post[];
  reports: Report[];
  appeals: Appeal[];
};

function createStore(): TestStore {
  return {
    users: [
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
        id: "usr_mod",
        handle: "queue_mod",
        displayName: "Queue Mod",
        role: "moderator",
        governanceAcceptedAt: "2026-02-01T00:00:00.000Z",
        humanVerifiedAt: "2026-02-01T00:00:00.000Z",
        createdAt: "2026-02-01T00:00:00.000Z",
        updatedAt: "2026-02-01T00:00:00.000Z"
      }
    ],
    posts: [
      {
        id: "pst_1",
        authorId: "usr_author",
        body: "Human-authored post",
        createdAt: "2026-02-01T00:00:00.000Z"
      }
    ],
    reports: [
      {
        id: "rpt_1",
        postId: "pst_1",
        reporterId: "usr_reporter",
        reason: "Policy concern",
        status: "resolved",
        createdAt: "2026-02-01T00:05:00.000Z"
      }
    ],
    appeals: []
  };
}

describe("parseCreateAppealPayload", () => {
  it("normalizes a valid payload", () => {
    const parsed = parseCreateAppealPayload({
      reportId: " rpt_1 ",
      reason: " Requesting review ",
      appealedAuditRecordId: "  rec_1  "
    });

    assert.equal(parsed.reportId, "rpt_1");
    assert.equal(parsed.reason, "Requesting review");
    assert.equal(parsed.appealedAuditRecordId, "rec_1");
  });

  it("rejects missing report id", () => {
    assert.throws(
      () => parseCreateAppealPayload({ reason: "Missing report" }),
      (error) => error instanceof AppealValidationError && error.code === "REPORT_ID_REQUIRED"
    );
  });
});

describe("createAppealRecord", () => {
  it("creates an appeal for an eligible user", () => {
    const store = createStore();

    const appeal = createAppealRecord(store, {
      reportId: "rpt_1",
      appellantId: "usr_reporter",
      reason: "Requesting second review",
      appealedAuditRecordId: "rec_123"
    });

    assert.equal(store.appeals.length, 1);
    assert.equal(appeal.status, "open");
    assert.equal(appeal.appealedAuditRecordId, "rec_123");
  });

  it("prevents duplicate active appeals", () => {
    const store = createStore();

    createAppealRecord(store, {
      reportId: "rpt_1",
      appellantId: "usr_reporter",
      reason: "Requesting second review"
    });

    assert.throws(
      () =>
        createAppealRecord(store, {
          reportId: "rpt_1",
          appellantId: "usr_reporter",
          reason: "Trying again"
        }),
      (error) => error instanceof AppealValidationError && error.code === "APPEAL_ALREADY_OPEN"
    );
  });

  it("rejects users not involved in the report", () => {
    const store = createStore();

    assert.throws(
      () =>
        createAppealRecord(store, {
          reportId: "rpt_1",
          appellantId: "usr_mod",
          reason: "Out-of-scope appeal"
        }),
      (error) => error instanceof AppealValidationError && error.code === "APPELLANT_NOT_ELIGIBLE"
    );
  });
});

describe("parseReviewAppealPayload", () => {
  it("requires explicit human confirmation", () => {
    assert.throws(
      () =>
        parseReviewAppealPayload(
          {
            decision: "grant",
            reason: "Approved",
            humanConfirmed: false
          },
          "apl_1"
        ),
      (error) => error instanceof AppealValidationError && error.code === "HUMAN_CONFIRMATION_REQUIRED"
    );
  });
});

describe("applyAppealDecision", () => {
  it("grants an appeal and reopens resolved reports", () => {
    const store = createStore();

    const created = createAppealRecord(
      store,
      {
        reportId: "rpt_1",
        appellantId: "usr_author",
        reason: "Please reevaluate context"
      },
      {
        nowIso: "2026-02-01T00:10:00.000Z"
      }
    );

    const command = parseReviewAppealPayload(
      {
        decision: "grant",
        reason: "Evidence supports escalation",
        humanConfirmed: true
      },
      created.id
    );

    const result = applyAppealDecision(
      store,
      {
        ...command,
        reviewerId: "usr_mod"
      },
      {
        nowIso: "2026-02-01T00:20:00.000Z"
      }
    );

    assert.equal(result.appeal.status, "granted");
    assert.equal(result.report.status, "triaged");
    assert.equal(result.reportReopened, true);
  });
});
