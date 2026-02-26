import {
  type AuditAction,
  type ImmutableAuditRecord,
  readAuditLog,
  verifyAuditLogChain
} from "@/lib/audit";
import type { Appeal, IdentityProfile, Report } from "@/lib/store";

const MODERATION_AUDIT_ACTIONS: ReadonlySet<AuditAction> = new Set([
  "report.created",
  "reports.queue.requested",
  "moderation.override.applied",
  "appeal.created",
  "appeals.queue.requested",
  "appeal.reviewed",
  "moderation.action_log.requested"
]);

type ActionLogStore = {
  users: IdentityProfile[];
  reports: Report[];
  appeals: Appeal[];
};

export type ModerationActionLogQuery = {
  reportId?: string;
  appealId?: string;
  beforeSequence?: number;
  limit: number;
};

export type ModerationActionLogEntry = {
  sequence: number;
  recordId: string;
  hash: string;
  previousHash: string | null;
  createdAt: string;
  actorId: string;
  actorHandle: string | null;
  action: AuditAction;
  targetType: ImmutableAuditRecord["targetType"];
  targetId?: string;
  reportId?: string;
  reportStatus?: Report["status"];
  appealId?: string;
  appealStatus?: Appeal["status"];
  metadata?: Record<string, unknown>;
};

export type ModerationActionLogResult = {
  entries: ModerationActionLogEntry[];
  pageInfo: {
    limit: number;
    nextBeforeSequence: number | null;
  };
  chain: { valid: true } | { valid: false; reason: string };
};

function coerceMetadataString(metadata: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function resolveReportId(record: ImmutableAuditRecord): string | undefined {
  if (record.targetType === "report" && record.targetId) {
    return record.targetId;
  }

  const metadataReportId = coerceMetadataString(record.metadata, "reportId");
  if (metadataReportId) {
    return metadataReportId;
  }

  const linkedReportId = coerceMetadataString(record.metadata, "linkedReportId");
  if (linkedReportId) {
    return linkedReportId;
  }

  return undefined;
}

function resolveAppealId(record: ImmutableAuditRecord): string | undefined {
  if (record.targetType === "appeal" && record.targetId) {
    return record.targetId;
  }

  return coerceMetadataString(record.metadata, "appealId");
}

function mapAuditRecordToEntry(store: ActionLogStore, record: ImmutableAuditRecord): ModerationActionLogEntry {
  const actorHandle = store.users.find((user) => user.id === record.actorId)?.handle ?? null;
  const reportId = resolveReportId(record);
  const appealId = resolveAppealId(record);

  const report = reportId ? store.reports.find((candidate) => candidate.id === reportId) : undefined;
  const appeal = appealId ? store.appeals.find((candidate) => candidate.id === appealId) : undefined;

  return {
    sequence: record.sequence,
    recordId: record.recordId,
    hash: record.hash,
    previousHash: record.previousHash,
    createdAt: record.createdAt,
    actorId: record.actorId,
    actorHandle,
    action: record.action,
    targetType: record.targetType,
    targetId: record.targetId,
    reportId,
    reportStatus: report?.status,
    appealId,
    appealStatus: appeal?.status,
    metadata: record.metadata
  };
}

export function buildModerationActionLog(store: ActionLogStore, query: ModerationActionLogQuery): ModerationActionLogResult {
  const auditRecords = readAuditLog();
  const chain = verifyAuditLogChain(auditRecords);

  let records = auditRecords.filter((record) => MODERATION_AUDIT_ACTIONS.has(record.action));

  const beforeSequence = query.beforeSequence;
  if (beforeSequence !== undefined) {
    records = records.filter((record) => record.sequence < beforeSequence);
  }

  if (query.reportId) {
    records = records.filter((record) => resolveReportId(record) === query.reportId);
  }

  if (query.appealId) {
    records = records.filter((record) => resolveAppealId(record) === query.appealId);
  }

  records.sort((left, right) => right.sequence - left.sequence);

  const sliced = records.slice(0, query.limit);
  const entries = sliced.map((record) => mapAuditRecordToEntry(store, record));

  const nextBeforeSequence =
    records.length > query.limit && entries.length > 0 ? entries[entries.length - 1]?.sequence ?? null : null;

  return {
    entries,
    pageInfo: {
      limit: query.limit,
      nextBeforeSequence
    },
    chain
  };
}
