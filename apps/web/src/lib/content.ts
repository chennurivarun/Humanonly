import { randomUUID } from "crypto";
import type { IdentityProfile, Post, Report } from "@/lib/store";

export const MAX_POST_LENGTH = 500;
export const MAX_REPORT_REASON_LENGTH = 500;

export type FeedAuthor = Pick<IdentityProfile, "id" | "handle" | "displayName">;

export type FeedItem = Post & {
  author: FeedAuthor | null;
};

export type FeedPage = {
  data: FeedItem[];
  pageInfo: {
    nextCursor: string | null;
    limit: number;
  };
};

type ContentStore = {
  users: IdentityProfile[];
  posts: Post[];
  reports: Report[];
};

export class ContentValidationError extends Error {
  readonly code:
    | "INVALID_JSON"
    | "BODY_REQUIRED"
    | "BODY_TOO_LONG"
    | "POST_ID_REQUIRED"
    | "REASON_REQUIRED"
    | "REASON_TOO_LONG"
    | "POST_NOT_FOUND";

  constructor(code: ContentValidationError["code"], message: string) {
    super(message);
    this.name = "ContentValidationError";
    this.code = code;
  }
}

export function parseCreatePostPayload(payload: unknown): { body: string } {
  if (!payload || typeof payload !== "object") {
    throw new ContentValidationError("INVALID_JSON", "Invalid JSON payload");
  }

  const body = String((payload as Record<string, unknown>).body ?? "").trim();

  if (!body) {
    throw new ContentValidationError("BODY_REQUIRED", "body is required");
  }

  if (body.length > MAX_POST_LENGTH) {
    throw new ContentValidationError("BODY_TOO_LONG", `body must be ${MAX_POST_LENGTH} characters or fewer`);
  }

  return { body };
}

export function parseCreateReportPayload(payload: unknown): { postId: string; reason: string } {
  if (!payload || typeof payload !== "object") {
    throw new ContentValidationError("INVALID_JSON", "Invalid JSON payload");
  }

  const body = payload as Record<string, unknown>;
  const postId = String(body.postId ?? "").trim();
  const reason = String(body.reason ?? "").trim();

  if (!postId) {
    throw new ContentValidationError("POST_ID_REQUIRED", "postId is required");
  }

  if (!reason) {
    throw new ContentValidationError("REASON_REQUIRED", "reason is required");
  }

  if (reason.length > MAX_REPORT_REASON_LENGTH) {
    throw new ContentValidationError(
      "REASON_TOO_LONG",
      `reason must be ${MAX_REPORT_REASON_LENGTH} characters or fewer`
    );
  }

  return { postId, reason };
}

export function createPostRecord(
  store: ContentStore,
  input: { authorId: string; body: string },
  options: {
    nowIso?: string;
    persist?: () => void;
  } = {}
): Post {
  const post: Post = {
    id: randomUUID(),
    authorId: input.authorId,
    body: input.body,
    createdAt: options.nowIso ?? new Date().toISOString()
  };

  store.posts.unshift(post);
  options.persist?.();
  return post;
}

export function createReportRecord(
  store: ContentStore,
  input: { postId: string; reporterId: string; reason: string },
  options: {
    nowIso?: string;
    persist?: () => void;
  } = {}
): Report {
  const referencedPost = store.posts.find((post) => post.id === input.postId);
  if (!referencedPost) {
    throw new ContentValidationError("POST_NOT_FOUND", "post not found");
  }

  const report: Report = {
    id: randomUUID(),
    postId: input.postId,
    reporterId: input.reporterId,
    reason: input.reason,
    status: "open",
    createdAt: options.nowIso ?? new Date().toISOString()
  };

  store.reports.unshift(report);
  options.persist?.();
  return report;
}

export function listFeedPage(
  store: ContentStore,
  input: { cursor?: string | null; limit?: number } = {}
): FeedPage {
  const limit = Math.min(Math.max(Number(input.limit ?? 10), 1), 50);
  const cursor = input.cursor?.trim() || null;

  const startIndex = cursor ? store.posts.findIndex((post) => post.id === cursor) + 1 : 0;
  const rows = store.posts.slice(Math.max(startIndex, 0), Math.max(startIndex, 0) + limit);

  const authors = new Map<string, FeedAuthor>();
  for (const user of store.users) {
    authors.set(user.id, {
      id: user.id,
      handle: user.handle,
      displayName: user.displayName
    });
  }

  const data: FeedItem[] = rows.map((post) => ({
    ...post,
    author: authors.get(post.authorId) ?? null
  }));

  const nextCursor = rows.length === limit ? rows[rows.length - 1]?.id ?? null : null;

  return {
    data,
    pageInfo: {
      nextCursor,
      limit
    }
  };
}
