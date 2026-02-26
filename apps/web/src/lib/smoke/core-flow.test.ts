import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ContentValidationError,
  createPostRecord,
  createReportRecord,
  listFeedPage,
  parseCreatePostPayload,
  parseCreateReportPayload
} from "@/lib/content";
import { buildIdentityProfile, parseOnboardingCredentials } from "@/lib/auth/onboarding";
import { parseOverrideCommand } from "@/lib/moderation/override";
import {
  applyAppealDecision,
  createAppealRecord,
  parseCreateAppealPayload,
  parseReviewAppealPayload
} from "@/lib/moderation/appeals";
import type { Appeal, IdentityProfile, Post, Report } from "@/lib/store";

type TestStore = {
  users: IdentityProfile[];
  posts: Post[];
  reports: Report[];
  appeals: Appeal[];
};

function createStore(): TestStore {
  return {
    users: [],
    posts: [],
    reports: [],
    appeals: []
  };
}

describe("smoke: onboarding -> post -> feed -> report -> override -> appeal", () => {
  it("covers the core sprint moderation and appeals path", () => {
    const store = createStore();

    const author = buildIdentityProfile(
      parseOnboardingCredentials({
        handle: "human_author",
        displayName: "Human Author",
        humanAttestation: "yes"
      })
    );

    const admin = buildIdentityProfile(
      parseOnboardingCredentials({
        handle: "admin_guard",
        displayName: "Admin Guard",
        humanAttestation: "yes"
      })
    );

    author.role = "member";
    admin.role = "admin";

    store.users.push(author, admin);

    const postCommand = parseCreatePostPayload({ body: "  HumanOnly launch post.  " });
    const post = createPostRecord(store, {
      authorId: author.id,
      body: postCommand.body
    });

    const feed = listFeedPage(store, { limit: 10 });
    assert.equal(feed.data.length, 1);
    assert.equal(feed.data[0]?.id, post.id);
    assert.equal(feed.data[0]?.author?.handle, "human_author");

    const reportCommand = parseCreateReportPayload({
      postId: post.id,
      reason: "Needs moderator review"
    });

    const report = createReportRecord(store, {
      postId: reportCommand.postId,
      reporterId: admin.id,
      reason: reportCommand.reason
    });

    const moderationQueue = store.reports.filter((item) => item.status !== "resolved");
    assert.equal(moderationQueue.length, 1);
    assert.equal(moderationQueue[0]?.id, report.id);

    const override = parseOverrideCommand({
      reportId: report.id,
      status: "resolved",
      reason: "Reviewed and closed by human admin",
      humanConfirmed: true
    });

    const queuedReport = store.reports.find((item) => item.id === override.reportId);
    assert.ok(queuedReport);
    queuedReport.status = override.status;

    const queueAfterOverride = store.reports.filter((item) => item.status !== "resolved");
    assert.equal(queueAfterOverride.length, 0);

    const appealCommand = parseCreateAppealPayload({
      reportId: report.id,
      reason: "Requesting second human review before final closure"
    });

    const appeal = createAppealRecord(store, {
      reportId: appealCommand.reportId,
      appellantId: author.id,
      reason: appealCommand.reason,
      appealedAuditRecordId: "audit_record_override_1"
    });

    assert.equal(appeal.status, "open");

    const reviewCommand = parseReviewAppealPayload(
      {
        decision: "grant",
        reason: "Human reviewer reopened report for additional context",
        humanConfirmed: true
      },
      appeal.id
    );

    const adjudication = applyAppealDecision(store, {
      ...reviewCommand,
      reviewerId: admin.id
    });

    assert.equal(adjudication.appeal.status, "granted");
    assert.equal(adjudication.report.status, "triaged");
    assert.equal(adjudication.reportReopened, true);
  });

  it("fails fast on invalid report payload during the smoke flow", () => {
    const store = createStore();
    const author = buildIdentityProfile(
      parseOnboardingCredentials({
        handle: "flow_author",
        displayName: "Flow Author",
        humanAttestation: "yes"
      })
    );

    store.users.push(author);

    const post = createPostRecord(store, {
      authorId: author.id,
      body: parseCreatePostPayload({ body: "Valid post" }).body
    });

    assert.throws(
      () =>
        createReportRecord(store, {
          postId: post.id,
          reporterId: author.id,
          reason: parseCreateReportPayload({ postId: post.id, reason: "   " }).reason
        }),
      (error) => error instanceof ContentValidationError && error.code === "REASON_REQUIRED"
    );
  });
});
