import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ContentValidationError,
  MAX_POST_LENGTH,
  MAX_REPORT_REASON_LENGTH,
  createReportRecord,
  listFeedPage,
  parseCreatePostPayload,
  parseCreateReportPayload
} from "./content";
import type { IdentityProfile, Post, Report } from "./store";

type TestStore = {
  users: IdentityProfile[];
  posts: Post[];
  reports: Report[];
};

function createStore(): TestStore {
  return {
    users: [
      {
        id: "usr_1",
        handle: "human_author",
        displayName: "Human Author",
        role: "member",
        governanceAcceptedAt: "2026-01-01T00:00:00.000Z",
        humanVerifiedAt: "2026-01-01T00:00:00.000Z",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z"
      },
      {
        id: "usr_2",
        handle: "civic_reader",
        displayName: "Civic Reader",
        role: "member",
        governanceAcceptedAt: "2026-01-01T00:00:00.000Z",
        humanVerifiedAt: "2026-01-01T00:00:00.000Z",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z"
      }
    ],
    posts: [
      {
        id: "pst_3",
        authorId: "usr_1",
        body: "Third post",
        createdAt: "2026-01-01T00:03:00.000Z"
      },
      {
        id: "pst_2",
        authorId: "usr_2",
        body: "Second post",
        createdAt: "2026-01-01T00:02:00.000Z"
      },
      {
        id: "pst_1",
        authorId: "usr_1",
        body: "First post",
        createdAt: "2026-01-01T00:01:00.000Z"
      }
    ],
    reports: []
  };
}

describe("parseCreatePostPayload", () => {
  it("normalizes and returns valid payload", () => {
    const parsed = parseCreatePostPayload({ body: "  Human message  " });
    assert.equal(parsed.body, "Human message");
  });

  it("rejects missing body", () => {
    assert.throws(
      () => parseCreatePostPayload({ body: "   " }),
      (error) => error instanceof ContentValidationError && error.code === "BODY_REQUIRED"
    );
  });

  it("rejects oversized body", () => {
    assert.throws(
      () => parseCreatePostPayload({ body: "x".repeat(MAX_POST_LENGTH + 1) }),
      (error) => error instanceof ContentValidationError && error.code === "BODY_TOO_LONG"
    );
  });
});

describe("parseCreateReportPayload", () => {
  it("accepts valid payload", () => {
    const parsed = parseCreateReportPayload({ postId: "pst_1", reason: "Policy concern" });
    assert.equal(parsed.postId, "pst_1");
    assert.equal(parsed.reason, "Policy concern");
  });

  it("requires post id", () => {
    assert.throws(
      () => parseCreateReportPayload({ reason: "Missing post" }),
      (error) => error instanceof ContentValidationError && error.code === "POST_ID_REQUIRED"
    );
  });

  it("rejects oversized reason", () => {
    assert.throws(
      () =>
        parseCreateReportPayload({
          postId: "pst_1",
          reason: "x".repeat(MAX_REPORT_REASON_LENGTH + 1)
        }),
      (error) => error instanceof ContentValidationError && error.code === "REASON_TOO_LONG"
    );
  });
});

describe("createReportRecord", () => {
  it("fails when post does not exist", () => {
    const store = createStore();

    assert.throws(
      () =>
        createReportRecord(store, {
          postId: "missing_post",
          reporterId: "usr_2",
          reason: "Invalid post"
        }),
      (error) => error instanceof ContentValidationError && error.code === "POST_NOT_FOUND"
    );
  });
});

describe("listFeedPage", () => {
  it("returns paginated feed rows with resolved author metadata", () => {
    const store = createStore();
    const firstPage = listFeedPage(store, { limit: 2 });

    assert.equal(firstPage.data.length, 2);
    assert.equal(firstPage.data[0]?.id, "pst_3");
    assert.equal(firstPage.data[0]?.author?.handle, "human_author");
    assert.equal(firstPage.pageInfo.nextCursor, "pst_2");

    const secondPage = listFeedPage(store, { limit: 2, cursor: firstPage.pageInfo.nextCursor });
    assert.equal(secondPage.data.length, 1);
    assert.equal(secondPage.data[0]?.id, "pst_1");
    assert.equal(secondPage.pageInfo.nextCursor, null);
  });

  it("falls back to first page for unknown cursor", () => {
    const store = createStore();
    const page = listFeedPage(store, { cursor: "unknown", limit: 1 });

    assert.equal(page.data[0]?.id, "pst_3");
  });
});
