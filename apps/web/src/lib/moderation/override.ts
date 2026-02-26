export const OVERRIDE_STATUSES = ["triaged", "resolved"] as const;

export type OverrideStatus = (typeof OVERRIDE_STATUSES)[number];

export type OverrideCommand = {
  reportId: string;
  status: OverrideStatus;
  reason: string;
  humanConfirmed: true;
};

export class OverrideValidationError extends Error {
  code:
    | "INVALID_JSON"
    | "REPORT_ID_REQUIRED"
    | "INVALID_STATUS"
    | "REASON_REQUIRED"
    | "REASON_TOO_LONG"
    | "HUMAN_CONFIRMATION_REQUIRED";

  constructor(code: OverrideValidationError["code"], message: string) {
    super(message);
    this.name = "OverrideValidationError";
    this.code = code;
  }
}

export function parseOverrideCommand(payload: unknown): OverrideCommand {
  if (!payload || typeof payload !== "object") {
    throw new OverrideValidationError("INVALID_JSON", "Invalid JSON payload");
  }

  const body = payload as Record<string, unknown>;
  const reportId = typeof body.reportId === "string" ? body.reportId.trim() : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const status = typeof body.status === "string" ? body.status : "";

  if (!reportId) {
    throw new OverrideValidationError("REPORT_ID_REQUIRED", "reportId is required");
  }

  if (!OVERRIDE_STATUSES.includes(status as OverrideStatus)) {
    throw new OverrideValidationError("INVALID_STATUS", "status must be triaged or resolved");
  }

  if (!reason) {
    throw new OverrideValidationError("REASON_REQUIRED", "reason is required");
  }

  if (reason.length > 500) {
    throw new OverrideValidationError("REASON_TOO_LONG", "reason must be 500 characters or fewer");
  }

  if (body.humanConfirmed !== true) {
    throw new OverrideValidationError("HUMAN_CONFIRMATION_REQUIRED", "humanConfirmed=true is required");
  }

  return {
    reportId,
    status: status as OverrideStatus,
    reason,
    humanConfirmed: true
  };
}
