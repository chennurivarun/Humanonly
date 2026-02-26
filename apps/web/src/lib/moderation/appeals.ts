import { randomUUID } from "node:crypto";
import type { Appeal, IdentityProfile, Post, Report } from "@/lib/store";

export const MAX_APPEAL_REASON_LENGTH = 500;
export const MAX_APPEAL_DECISION_REASON_LENGTH = 500;

export const APPEAL_STATUSES = ["open", "under_review", "upheld", "granted"] as const;
export type AppealStatus = (typeof APPEAL_STATUSES)[number];

export const APPEAL_DECISIONS = ["uphold", "grant"] as const;
export type AppealDecision = (typeof APPEAL_DECISIONS)[number];

type ModerationStore = {
  users: IdentityProfile[];
  posts: Post[];
  reports: Report[];
  appeals: Appeal[];
};

export type CreateAppealCommand = {
  reportId: string;
  reason: string;
  appealedAuditRecordId?: string;
};

export type ReviewAppealCommand = {
  appealId: string;
  decision: AppealDecision;
  reason: string;
  humanConfirmed: true;
};

export class AppealValidationError extends Error {
  readonly code:
    | "INVALID_JSON"
    | "REPORT_ID_REQUIRED"
    | "REASON_REQUIRED"
    | "REASON_TOO_LONG"
    | "REPORT_NOT_FOUND"
    | "APPELLANT_NOT_ELIGIBLE"
    | "APPEAL_ALREADY_OPEN"
    | "APPEAL_ID_REQUIRED"
    | "DECISION_REQUIRED"
    | "DECISION_REASON_REQUIRED"
    | "DECISION_REASON_TOO_LONG"
    | "HUMAN_CONFIRMATION_REQUIRED"
    | "APPEAL_NOT_FOUND"
    | "APPEAL_ALREADY_DECIDED";

  constructor(code: AppealValidationError["code"], message: string) {
    super(message);
    this.name = "AppealValidationError";
    this.code = code;
  }
}

export function parseCreateAppealPayload(payload: unknown): CreateAppealCommand {
  if (!payload || typeof payload !== "object") {
    throw new AppealValidationError("INVALID_JSON", "Invalid JSON payload");
  }

  const body = payload as Record<string, unknown>;
  const reportId = typeof body.reportId === "string" ? body.reportId.trim() : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";

  if (!reportId) {
    throw new AppealValidationError("REPORT_ID_REQUIRED", "reportId is required");
  }

  if (!reason) {
    throw new AppealValidationError("REASON_REQUIRED", "reason is required");
  }

  if (reason.length > MAX_APPEAL_REASON_LENGTH) {
    throw new AppealValidationError(
      "REASON_TOO_LONG",
      `reason must be ${MAX_APPEAL_REASON_LENGTH} characters or fewer`
    );
  }

  const appealedAuditRecordId =
    typeof body.appealedAuditRecordId === "string" && body.appealedAuditRecordId.trim()
      ? body.appealedAuditRecordId.trim()
      : undefined;

  return {
    reportId,
    reason,
    appealedAuditRecordId
  };
}

export function parseReviewAppealPayload(payload: unknown, appealId: string): ReviewAppealCommand {
  if (!appealId.trim()) {
    throw new AppealValidationError("APPEAL_ID_REQUIRED", "appealId is required");
  }

  if (!payload || typeof payload !== "object") {
    throw new AppealValidationError("INVALID_JSON", "Invalid JSON payload");
  }

  const body = payload as Record<string, unknown>;
  const decision = typeof body.decision === "string" ? body.decision.trim() : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";

  if (!APPEAL_DECISIONS.includes(decision as AppealDecision)) {
    throw new AppealValidationError("DECISION_REQUIRED", "decision must be uphold or grant");
  }

  if (!reason) {
    throw new AppealValidationError("DECISION_REASON_REQUIRED", "reason is required");
  }

  if (reason.length > MAX_APPEAL_DECISION_REASON_LENGTH) {
    throw new AppealValidationError(
      "DECISION_REASON_TOO_LONG",
      `reason must be ${MAX_APPEAL_DECISION_REASON_LENGTH} characters or fewer`
    );
  }

  if (body.humanConfirmed !== true) {
    throw new AppealValidationError("HUMAN_CONFIRMATION_REQUIRED", "humanConfirmed=true is required");
  }

  return {
    appealId,
    decision: decision as AppealDecision,
    reason,
    humanConfirmed: true
  };
}

function canUserAppealReport(store: ModerationStore, report: Report, actorId: string): boolean {
  if (report.reporterId === actorId) {
    return true;
  }

  const post = store.posts.find((candidate) => candidate.id === report.postId);
  if (!post) {
    return false;
  }

  return post.authorId === actorId;
}

export function createAppealRecord(
  store: ModerationStore,
  input: { reportId: string; appellantId: string; reason: string; appealedAuditRecordId?: string },
  options: {
    nowIso?: string;
    persist?: () => void;
  } = {}
): Appeal {
  const report = store.reports.find((candidate) => candidate.id === input.reportId);
  if (!report) {
    throw new AppealValidationError("REPORT_NOT_FOUND", "report not found");
  }

  if (!canUserAppealReport(store, report, input.appellantId)) {
    throw new AppealValidationError(
      "APPELLANT_NOT_ELIGIBLE",
      "only the report author or reported post author can submit an appeal"
    );
  }

  const alreadyOpen = store.appeals.some(
    (appeal) =>
      appeal.reportId === input.reportId &&
      appeal.appellantId === input.appellantId &&
      (appeal.status === "open" || appeal.status === "under_review")
  );

  if (alreadyOpen) {
    throw new AppealValidationError("APPEAL_ALREADY_OPEN", "an active appeal already exists for this report");
  }

  const nowIso = options.nowIso ?? new Date().toISOString();

  const appeal: Appeal = {
    id: randomUUID(),
    reportId: input.reportId,
    appellantId: input.appellantId,
    reason: input.reason,
    status: "open",
    appealedAuditRecordId: input.appealedAuditRecordId,
    createdAt: nowIso,
    updatedAt: nowIso
  };

  store.appeals.unshift(appeal);
  options.persist?.();

  return appeal;
}

export function applyAppealDecision(
  store: ModerationStore,
  input: ReviewAppealCommand & { reviewerId: string },
  options: {
    nowIso?: string;
    persist?: () => void;
  } = {}
): {
  appeal: Appeal;
  report: Report;
  previousAppealStatus: AppealStatus;
  previousReportStatus: Report["status"];
  reportReopened: boolean;
} {
  const appeal = store.appeals.find((candidate) => candidate.id === input.appealId);
  if (!appeal) {
    throw new AppealValidationError("APPEAL_NOT_FOUND", "appeal not found");
  }

  if (appeal.status === "upheld" || appeal.status === "granted") {
    throw new AppealValidationError("APPEAL_ALREADY_DECIDED", "appeal has already been adjudicated");
  }

  const report = store.reports.find((candidate) => candidate.id === appeal.reportId);
  if (!report) {
    throw new AppealValidationError("REPORT_NOT_FOUND", "report not found");
  }

  const nowIso = options.nowIso ?? new Date().toISOString();
  const previousAppealStatus = appeal.status;
  const previousReportStatus = report.status;

  appeal.status = input.decision === "grant" ? "granted" : "upheld";
  appeal.decidedById = input.reviewerId;
  appeal.decidedAt = nowIso;
  appeal.decisionRationale = input.reason;
  appeal.updatedAt = nowIso;

  let reportReopened = false;
  if (input.decision === "grant" && report.status === "resolved") {
    report.status = "triaged";
    reportReopened = true;
  }

  options.persist?.();

  return {
    appeal,
    report,
    previousAppealStatus,
    previousReportStatus,
    reportReopened
  };
}
