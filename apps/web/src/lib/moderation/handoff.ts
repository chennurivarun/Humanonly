import type { Appeal, Report } from "@/lib/store";

export const MODERATION_HANDOFF_ACTIONS = ["triage", "escalate", "resolve_note"] as const;
export type ModerationHandoffAction = (typeof MODERATION_HANDOFF_ACTIONS)[number];

export const MODERATION_HANDOFF_TARGETS = ["report", "appeal"] as const;
export type ModerationHandoffTarget = (typeof MODERATION_HANDOFF_TARGETS)[number];

export const MODERATION_HANDOFF_ROLES = ["moderator", "admin"] as const;
export type ModerationHandoffRole = (typeof MODERATION_HANDOFF_ROLES)[number];

export type ModerationHandoffTemplate = {
  id: string;
  action: ModerationHandoffAction;
  label: string;
  summary: string;
};

export const MODERATION_HANDOFF_TEMPLATES: readonly ModerationHandoffTemplate[] = [
  {
    id: "triage_intake",
    action: "triage",
    label: "Triage intake",
    summary: "Initial triage completed; route queued for moderator handling."
  },
  {
    id: "escalate_policy",
    action: "escalate",
    label: "Escalate to governance",
    summary: "Escalated for policy interpretation and admin review."
  },
  {
    id: "resolve_note_context",
    action: "resolve_note",
    label: "Resolution context",
    summary: "Attached human-authored context for final decisioning."
  }
] as const;

const TEMPLATE_MAP = new Map(MODERATION_HANDOFF_TEMPLATES.map((template) => [template.id, template]));

export type ModerationHandoffCommand = {
  action: ModerationHandoffAction;
  targetType: ModerationHandoffTarget;
  targetId: string;
  templateId: string;
  note?: string;
  handoffToRole?: ModerationHandoffRole;
  humanConfirmed: true;
};

export type ModerationHandoffResult = {
  targetType: ModerationHandoffTarget;
  targetId: string;
  action: ModerationHandoffAction;
  template: ModerationHandoffTemplate;
  handoffToRole: ModerationHandoffRole | null;
  note: string | null;
  previousStatus: Report["status"] | Appeal["status"];
  nextStatus: Report["status"] | Appeal["status"];
  statusChanged: boolean;
};

export class ModerationHandoffValidationError extends Error {
  readonly code:
    | "INVALID_JSON"
    | "ACTION_REQUIRED"
    | "TARGET_TYPE_REQUIRED"
    | "TARGET_ID_REQUIRED"
    | "TEMPLATE_REQUIRED"
    | "TEMPLATE_INVALID"
    | "TEMPLATE_ACTION_MISMATCH"
    | "ROLE_INVALID"
    | "ROLE_REQUIRED"
    | "NOTE_TOO_LONG"
    | "HUMAN_CONFIRMATION_REQUIRED"
    | "TARGET_NOT_FOUND";

  constructor(code: ModerationHandoffValidationError["code"], message: string) {
    super(message);
    this.name = "ModerationHandoffValidationError";
    this.code = code;
  }
}

export function parseModerationHandoffPayload(payload: unknown): ModerationHandoffCommand {
  if (!payload || typeof payload !== "object") {
    throw new ModerationHandoffValidationError("INVALID_JSON", "Invalid JSON payload");
  }

  const body = payload as Record<string, unknown>;

  const action = typeof body.action === "string" ? body.action.trim() : "";
  if (!MODERATION_HANDOFF_ACTIONS.includes(action as ModerationHandoffAction)) {
    throw new ModerationHandoffValidationError(
      "ACTION_REQUIRED",
      "action must be triage, escalate, or resolve_note"
    );
  }

  const targetType = typeof body.targetType === "string" ? body.targetType.trim() : "";
  if (!MODERATION_HANDOFF_TARGETS.includes(targetType as ModerationHandoffTarget)) {
    throw new ModerationHandoffValidationError("TARGET_TYPE_REQUIRED", "targetType must be report or appeal");
  }

  const targetId = typeof body.targetId === "string" ? body.targetId.trim() : "";
  if (!targetId) {
    throw new ModerationHandoffValidationError("TARGET_ID_REQUIRED", "targetId is required");
  }

  const templateId = typeof body.templateId === "string" ? body.templateId.trim() : "";
  if (!templateId) {
    throw new ModerationHandoffValidationError("TEMPLATE_REQUIRED", "templateId is required");
  }

  const template = TEMPLATE_MAP.get(templateId);
  if (!template) {
    throw new ModerationHandoffValidationError("TEMPLATE_INVALID", "templateId is not recognized");
  }

  if (template.action !== action) {
    throw new ModerationHandoffValidationError(
      "TEMPLATE_ACTION_MISMATCH",
      "templateId does not match selected action"
    );
  }

  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (note.length > 500) {
    throw new ModerationHandoffValidationError("NOTE_TOO_LONG", "note must be 500 characters or fewer");
  }

  const rawRole = typeof body.handoffToRole === "string" ? body.handoffToRole.trim() : "";
  const parsedRole = rawRole || (action === "escalate" ? "admin" : "");

  if (parsedRole && !MODERATION_HANDOFF_ROLES.includes(parsedRole as ModerationHandoffRole)) {
    throw new ModerationHandoffValidationError("ROLE_INVALID", "handoffToRole must be moderator or admin");
  }

  if (action === "escalate" && !parsedRole) {
    throw new ModerationHandoffValidationError("ROLE_REQUIRED", "handoffToRole is required for escalate actions");
  }

  if (body.humanConfirmed !== true) {
    throw new ModerationHandoffValidationError(
      "HUMAN_CONFIRMATION_REQUIRED",
      "humanConfirmed=true is required"
    );
  }

  return {
    action: action as ModerationHandoffAction,
    targetType: targetType as ModerationHandoffTarget,
    targetId,
    templateId,
    note: note || undefined,
    handoffToRole: parsedRole ? (parsedRole as ModerationHandoffRole) : undefined,
    humanConfirmed: true
  };
}

type HandoffStore = {
  reports: Report[];
  appeals: Appeal[];
};

function nextReportStatusForAction(status: Report["status"], action: ModerationHandoffAction): Report["status"] {
  if (action === "triage" && status === "open") {
    return "triaged";
  }

  return status;
}

function nextAppealStatusForAction(status: Appeal["status"], action: ModerationHandoffAction): Appeal["status"] {
  if (action === "triage" && status === "open") {
    return "under_review";
  }

  return status;
}

export function applyModerationHandoff(
  store: HandoffStore,
  command: ModerationHandoffCommand,
  options: {
    persist?: () => void;
  } = {}
): ModerationHandoffResult {
  const template = TEMPLATE_MAP.get(command.templateId);
  if (!template) {
    throw new ModerationHandoffValidationError("TEMPLATE_INVALID", "templateId is not recognized");
  }

  if (command.targetType === "report") {
    const report = store.reports.find((candidate) => candidate.id === command.targetId);
    if (!report) {
      throw new ModerationHandoffValidationError("TARGET_NOT_FOUND", "report not found");
    }

    const previousStatus = report.status;
    const nextStatus = nextReportStatusForAction(previousStatus, command.action);

    if (nextStatus !== previousStatus) {
      report.status = nextStatus;
      options.persist?.();
    }

    return {
      targetType: "report",
      targetId: report.id,
      action: command.action,
      template,
      handoffToRole: command.handoffToRole ?? null,
      note: command.note ?? null,
      previousStatus,
      nextStatus,
      statusChanged: previousStatus !== nextStatus
    };
  }

  const appeal = store.appeals.find((candidate) => candidate.id === command.targetId);
  if (!appeal) {
    throw new ModerationHandoffValidationError("TARGET_NOT_FOUND", "appeal not found");
  }

  const previousStatus = appeal.status;
  const nextStatus = nextAppealStatusForAction(previousStatus, command.action);

  if (nextStatus !== previousStatus) {
    appeal.status = nextStatus;
    appeal.updatedAt = new Date().toISOString();
    options.persist?.();
  }

  return {
    targetType: "appeal",
    targetId: appeal.id,
    action: command.action,
    template,
    handoffToRole: command.handoffToRole ?? null,
    note: command.note ?? null,
    previousStatus,
    nextStatus,
    statusChanged: previousStatus !== nextStatus
  };
}

export function getModerationHandoffTemplate(templateId: string): ModerationHandoffTemplate | undefined {
  return TEMPLATE_MAP.get(templateId);
}
