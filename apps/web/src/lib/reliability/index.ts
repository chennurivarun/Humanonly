import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { GOVERNANCE_ASSERTIONS } from "@/lib/governed-store";
import { readAuditLog, verifyAuditLogChain } from "@/lib/audit";
import type { Appeal, IdentityProfile, Report } from "@/lib/store";

// ── Thresholds ────────────────────────────────────────────────────────────────

export type ReliabilityThresholds = {
  oldestOpenReportAgeHoursAlert: number;
  openReportsCountAlert: number;
  openAppealsCountAlert: number;
};

export const RELIABILITY_THRESHOLDS: ReliabilityThresholds = {
  /** Alert when the oldest open report is older than this many hours. */
  oldestOpenReportAgeHoursAlert: 48,
  /** Alert when there are more than this many open reports. */
  openReportsCountAlert: 20,
  /** Alert when there are more than this many open appeals. */
  openAppealsCountAlert: 10
};

// ── Types ─────────────────────────────────────────────────────────────────────

export type StorageHealthCheck = {
  label: string;
  filePath: string;
  exists: boolean;
  sizeBytes: number | null;
  lastModifiedAt: string | null;
  healthy: boolean;
};

export type AuditChainIntegrity = {
  totalRecords: number;
  lastSequence: number | null;
  chainValid: boolean;
  chainError: string | null;
};

export type QueueLatencyAlert = {
  metric: string;
  value: number;
  threshold: number;
  exceeded: boolean;
};

export type QueueLatencyMetrics = {
  openReports: number;
  openAppeals: number;
  oldestOpenReportAgeHours: number | null;
  oldestOpenAppealAgeHours: number | null;
  alerts: QueueLatencyAlert[];
};

export type ReliabilityStatus = {
  generatedAt: string;
  governance: typeof GOVERNANCE_ASSERTIONS;
  healthy: boolean;
  storage: StorageHealthCheck[];
  auditChain: AuditChainIntegrity;
  queueLatency: QueueLatencyMetrics;
};

// ── Store shape accepted by this module ───────────────────────────────────────

type ReliabilityStore = {
  reports: Report[];
  appeals: Appeal[];
  users: IdentityProfile[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function round(value: number, digits = 1): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function toTimestamp(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function resolveFilePath(envVar: string, defaultRelative: string): string {
  const configured = process.env[envVar]?.trim() || defaultRelative;
  return path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured);
}

// ── Storage health check ──────────────────────────────────────────────────────

export function checkStorageFile(label: string, filePath: string): StorageHealthCheck {
  if (!existsSync(filePath)) {
    return {
      label,
      filePath,
      exists: false,
      sizeBytes: null,
      lastModifiedAt: null,
      healthy: false
    };
  }

  try {
    const stat = statSync(filePath);
    return {
      label,
      filePath,
      exists: true,
      sizeBytes: stat.size,
      lastModifiedAt: stat.mtime.toISOString(),
      healthy: true
    };
  } catch {
    return {
      label,
      filePath,
      exists: true,
      sizeBytes: null,
      lastModifiedAt: null,
      healthy: false
    };
  }
}

export function checkStorageHealth(): StorageHealthCheck[] {
  const auditLogPath = resolveFilePath("HUMANONLY_AUDIT_LOG_FILE", ".data/audit-log.jsonl");
  const dataStorePath = resolveFilePath("HUMANONLY_DATA_FILE", ".data/store.json");

  return [
    checkStorageFile("Governed data snapshot", dataStorePath),
    checkStorageFile("Immutable audit log", auditLogPath)
  ];
}

// ── Audit chain integrity ─────────────────────────────────────────────────────

export function checkAuditChainIntegrity(): AuditChainIntegrity {
  const records = readAuditLog();
  const result = verifyAuditLogChain(records);

  const lastSequence = records.length > 0 ? (records[records.length - 1]?.sequence ?? null) : null;

  return {
    totalRecords: records.length,
    lastSequence,
    chainValid: result.valid,
    chainError: result.valid ? null : result.reason
  };
}

// ── Queue latency metrics ─────────────────────────────────────────────────────

export function buildQueueLatencyMetrics(
  store: ReliabilityStore,
  nowIso = new Date().toISOString(),
  thresholds: ReliabilityThresholds = RELIABILITY_THRESHOLDS
): QueueLatencyMetrics {
  const nowMs = Date.parse(nowIso);
  const openReports = store.reports.filter((r) => r.status === "open");
  const openAppeals = store.appeals.filter((a) => a.status === "open" || a.status === "under_review");

  const oldestOpenReportAgeHours = (() => {
    if (openReports.length === 0 || Number.isNaN(nowMs)) {
      return null;
    }

    const timestamps = openReports
      .map((r) => toTimestamp(r.createdAt))
      .filter((v): v is number => v !== null);

    if (timestamps.length === 0) {
      return null;
    }

    return round((nowMs - Math.min(...timestamps)) / (1000 * 60 * 60), 1);
  })();

  const oldestOpenAppealAgeHours = (() => {
    if (openAppeals.length === 0 || Number.isNaN(nowMs)) {
      return null;
    }

    const timestamps = openAppeals
      .map((a) => toTimestamp(a.createdAt))
      .filter((v): v is number => v !== null);

    if (timestamps.length === 0) {
      return null;
    }

    return round((nowMs - Math.min(...timestamps)) / (1000 * 60 * 60), 1);
  })();

  const alerts: QueueLatencyAlert[] = [
    {
      metric: "openReportsCount",
      value: openReports.length,
      threshold: thresholds.openReportsCountAlert,
      exceeded: openReports.length > thresholds.openReportsCountAlert
    },
    {
      metric: "openAppealsCount",
      value: openAppeals.length,
      threshold: thresholds.openAppealsCountAlert,
      exceeded: openAppeals.length > thresholds.openAppealsCountAlert
    },
    {
      metric: "oldestOpenReportAgeHours",
      value: oldestOpenReportAgeHours ?? 0,
      threshold: thresholds.oldestOpenReportAgeHoursAlert,
      exceeded:
        oldestOpenReportAgeHours !== null &&
        oldestOpenReportAgeHours > thresholds.oldestOpenReportAgeHoursAlert
    }
  ];

  return {
    openReports: openReports.length,
    openAppeals: openAppeals.length,
    oldestOpenReportAgeHours,
    oldestOpenAppealAgeHours,
    alerts
  };
}

// ── Aggregated reliability status ─────────────────────────────────────────────

export type BuildReliabilityStatusOptions = {
  nowIso?: string;
  thresholds?: ReliabilityThresholds;
};

export function buildReliabilityStatus(
  store: ReliabilityStore,
  options: BuildReliabilityStatusOptions = {}
): ReliabilityStatus {
  const nowIso = options.nowIso ?? new Date().toISOString();
  const thresholds = options.thresholds ?? RELIABILITY_THRESHOLDS;

  const storage = checkStorageHealth();
  const auditChain = checkAuditChainIntegrity();
  const queueLatency = buildQueueLatencyMetrics(store, nowIso, thresholds);

  const storageHealthy = storage.every((check) => check.healthy);
  const chainHealthy = auditChain.chainValid;
  const queueHealthy = !queueLatency.alerts.some((alert) => alert.exceeded);
  const healthy = storageHealthy && chainHealthy && queueHealthy;

  return {
    generatedAt: nowIso,
    governance: GOVERNANCE_ASSERTIONS,
    healthy,
    storage,
    auditChain,
    queueLatency
  };
}
