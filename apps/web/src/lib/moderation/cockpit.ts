import { readAuditLog } from "@/lib/audit";
import { computeTrustScore, type TrustScore } from "@/lib/trust";
import type { Appeal, IdentityProfile, Post, Report } from "@/lib/store";

export type ModerationRiskTier = TrustScore["tier"];
export type ModerationQueueKind = "report" | "appeal";

export type ModerationSlaStatus = {
  targetHours: number;
  ageHours: number;
  remainingHours: number;
  breached: boolean;
  breachByHours: number | null;
};

export type ModerationHandoffSnapshot = {
  sequence: number;
  createdAt: string;
  actorId: string;
  action: "triage" | "escalate" | "resolve_note";
  templateId: string | null;
  handoffToRole: "moderator" | "admin" | null;
  note: string | null;
  previousStatus: string | null;
  nextStatus: string | null;
};

export type ModerationCockpitQueueItem = {
  queueType: ModerationQueueKind;
  id: string;
  createdAt: string;
  status: string;
  ageHours: number;
  priorityScore: number;
  riskTier: ModerationRiskTier;
  riskScore: number;
  priorityFactors: string[];
  summary: string;
  sla: ModerationSlaStatus;
  latestHandoff: ModerationHandoffSnapshot | null;
  report?: {
    reporter: {
      id: string;
      handle: string;
      role: IdentityProfile["role"];
      trust: TrustScore | null;
    } | null;
    author: {
      id: string;
      handle: string;
      role: IdentityProfile["role"];
      trust: TrustScore | null;
    } | null;
    reason: string;
    postPreview: string | null;
  };
  appeal?: {
    appellant: {
      id: string;
      handle: string;
      role: IdentityProfile["role"];
      trust: TrustScore | null;
    } | null;
    reason: string;
    reportId: string;
    linkedReportStatus: Report["status"] | null;
  };
};

export type ModerationCockpitSnapshot = {
  generatedAt: string;
  filtersApplied: {
    queue: "all" | ModerationQueueKind;
    statuses: string[];
    riskTiers: ModerationRiskTier[];
    minAgeHours: number | null;
    maxAgeHours: number | null;
    limit: number;
  };
  summary: {
    totalCandidates: number;
    returnedItems: number;
    reportQueue: {
      open: number;
      triaged: number;
      breached: number;
    };
    appealQueue: {
      open: number;
      underReview: number;
      breached: number;
    };
    sla: {
      breachedTotal: number;
      dueWithinHour: number;
      maxBreachHours: number | null;
    };
  };
  queue: ModerationCockpitQueueItem[];
};

type CockpitStore = {
  users: IdentityProfile[];
  posts: Post[];
  reports: Report[];
  appeals: Appeal[];
};

export type BuildModerationCockpitOptions = {
  nowIso?: string;
  queue?: "all" | ModerationQueueKind;
  statuses?: string[];
  riskTiers?: ModerationRiskTier[];
  minAgeHours?: number;
  maxAgeHours?: number;
  limit?: number;
};

const STATUS_PRIORITY_WEIGHT: Record<string, number> = {
  open: 28,
  triaged: 20,
  under_review: 18,
  resolved: 0,
  granted: 0,
  upheld: 0
};

const RISK_PRIORITY_WEIGHT: Record<ModerationRiskTier, number> = {
  restricted: 30,
  watch: 20,
  steady: 10,
  trusted: 0
};

function round(value: number, digits = 1): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function toTimestamp(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function clampLimit(value: number | undefined, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(Math.floor(value as number), min), max);
}

function normalizeRiskTiers(raw: ModerationRiskTier[] | undefined): ModerationRiskTier[] {
  if (!raw || raw.length === 0) {
    return [];
  }

  return Array.from(new Set(raw)).filter((tier): tier is ModerationRiskTier =>
    ["restricted", "watch", "steady", "trusted"].includes(tier)
  );
}

function tierFromScore(score: number): ModerationRiskTier {
  if (score >= 80) return "trusted";
  if (score >= 50) return "steady";
  if (score >= 30) return "watch";
  return "restricted";
}

function computeSla(ageHours: number, targetHours: number): ModerationSlaStatus {
  const breached = ageHours > targetHours;
  const remainingHours = round(targetHours - ageHours, 1);

  return {
    targetHours,
    ageHours,
    remainingHours,
    breached,
    breachByHours: breached ? round(ageHours - targetHours, 1) : null
  };
}

function computePriorityScore(input: {
  status: string;
  riskTier: ModerationRiskTier;
  ageHours: number;
  slaBreached: boolean;
}): number {
  const statusWeight = STATUS_PRIORITY_WEIGHT[input.status] ?? 0;
  const riskWeight = RISK_PRIORITY_WEIGHT[input.riskTier];
  const ageWeight = (Math.min(Math.max(input.ageHours, 0), 72) / 72) * 35;
  const slaWeight = input.slaBreached ? 12 : 0;

  return round(statusWeight + riskWeight + ageWeight + slaWeight, 1);
}

function shorten(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(maxLength - 1, 1)).trimEnd()}…`;
}

function latestHandoffByTarget(): Map<string, ModerationHandoffSnapshot> {
  const records = readAuditLog();
  const handoffs = new Map<string, ModerationHandoffSnapshot>();

  for (const record of records) {
    if (record.action !== "moderation.handoff.recorded") {
      continue;
    }

    const targetType =
      typeof record.metadata?.targetType === "string" &&
      (record.metadata.targetType === "report" || record.metadata.targetType === "appeal")
        ? (record.metadata.targetType as ModerationQueueKind)
        : null;

    const targetId = typeof record.metadata?.targetId === "string" ? record.metadata.targetId : null;

    if (!targetType || !targetId) {
      continue;
    }

    const action =
      typeof record.metadata?.action === "string" &&
      ["triage", "escalate", "resolve_note"].includes(record.metadata.action)
        ? (record.metadata.action as ModerationHandoffSnapshot["action"])
        : null;

    if (!action) {
      continue;
    }

    const key = `${targetType}:${targetId}`;
    const existing = handoffs.get(key);
    if (existing && existing.sequence > record.sequence) {
      continue;
    }

    handoffs.set(key, {
      sequence: record.sequence,
      createdAt: record.createdAt,
      actorId: record.actorId,
      action,
      templateId: typeof record.metadata?.templateId === "string" ? record.metadata.templateId : null,
      handoffToRole:
        record.metadata?.handoffToRole === "moderator" || record.metadata?.handoffToRole === "admin"
          ? (record.metadata.handoffToRole as "moderator" | "admin")
          : null,
      note: typeof record.metadata?.note === "string" ? record.metadata.note : null,
      previousStatus:
        typeof record.metadata?.previousStatus === "string" ? record.metadata.previousStatus : null,
      nextStatus: typeof record.metadata?.nextStatus === "string" ? record.metadata.nextStatus : null
    });
  }

  return handoffs;
}

export function buildModerationCockpit(
  store: CockpitStore,
  options: BuildModerationCockpitOptions = {}
): ModerationCockpitSnapshot {
  const nowIso = options.nowIso ?? new Date().toISOString();
  const nowTs = toTimestamp(nowIso) ?? Date.now();
  const queueFilter = options.queue ?? "all";
  const statuses = (options.statuses ?? []).map((status) => status.trim()).filter(Boolean);
  const riskTiers = normalizeRiskTiers(options.riskTiers);
  const minAgeHours = Number.isFinite(options.minAgeHours) ? Math.max(options.minAgeHours as number, 0) : null;
  const maxAgeHours = Number.isFinite(options.maxAgeHours) ? Math.max(options.maxAgeHours as number, 0) : null;
  const limit = clampLimit(options.limit, 25, 1, 100);

  const userById = new Map(store.users.map((user) => [user.id, user]));
  const postById = new Map(store.posts.map((post) => [post.id, post]));
  const reportById = new Map(store.reports.map((report) => [report.id, report]));
  const handoffMap = latestHandoffByTarget();

  const trustCache = new Map<string, TrustScore>();
  function trustFor(userId: string | undefined): TrustScore | null {
    if (!userId) {
      return null;
    }

    if (trustCache.has(userId)) {
      return trustCache.get(userId) ?? null;
    }

    const exists = store.users.some((user) => user.id === userId);
    if (!exists) {
      return null;
    }

    const trust = computeTrustScore(store, userId, nowIso);
    trustCache.set(userId, trust);
    return trust;
  }

  const queueItems: ModerationCockpitQueueItem[] = [];

  if (queueFilter === "all" || queueFilter === "report") {
    for (const report of store.reports) {
      if (report.status === "resolved") {
        continue;
      }

      const createdAtTs = toTimestamp(report.createdAt) ?? nowTs;
      const ageHours = round(Math.max(0, nowTs - createdAtTs) / (1000 * 60 * 60), 1);

      const reporter = userById.get(report.reporterId) ?? null;
      const post = postById.get(report.postId) ?? null;
      const author = post ? (userById.get(post.authorId) ?? null) : null;
      const reporterTrust = trustFor(reporter?.id);
      const authorTrust = trustFor(author?.id);

      const trustScores = [reporterTrust?.score, authorTrust?.score].filter(
        (value): value is number => typeof value === "number"
      );
      const riskScore = trustScores.length > 0 ? Math.min(...trustScores) : 50;
      const riskTier = tierFromScore(riskScore);
      const sla = computeSla(ageHours, report.status === "open" ? 4 : 12);

      queueItems.push({
        queueType: "report",
        id: report.id,
        createdAt: report.createdAt,
        status: report.status,
        ageHours,
        priorityScore: computePriorityScore({
          status: report.status,
          riskTier,
          ageHours,
          slaBreached: sla.breached
        }),
        riskTier,
        riskScore,
        priorityFactors: [
          `${report.status} status`,
          `${riskTier} trust risk`,
          sla.breached ? `SLA breached by ${sla.breachByHours}h` : `SLA due in ${sla.remainingHours}h`
        ],
        summary: shorten(report.reason, 200),
        sla,
        latestHandoff: handoffMap.get(`report:${report.id}`) ?? null,
        report: {
          reporter: reporter
            ? {
                id: reporter.id,
                handle: reporter.handle,
                role: reporter.role,
                trust: reporterTrust
              }
            : null,
          author: author
            ? {
                id: author.id,
                handle: author.handle,
                role: author.role,
                trust: authorTrust
              }
            : null,
          reason: report.reason,
          postPreview: post ? shorten(post.body, 140) : null
        }
      });
    }
  }

  if (queueFilter === "all" || queueFilter === "appeal") {
    for (const appeal of store.appeals) {
      if (appeal.status !== "open" && appeal.status !== "under_review") {
        continue;
      }

      const createdAtTs = toTimestamp(appeal.createdAt) ?? nowTs;
      const ageHours = round(Math.max(0, nowTs - createdAtTs) / (1000 * 60 * 60), 1);
      const appellant = userById.get(appeal.appellantId) ?? null;
      const appellantTrust = trustFor(appellant?.id);
      const riskScore = appellantTrust?.score ?? 50;
      const riskTier = tierFromScore(riskScore);
      const linkedReport = reportById.get(appeal.reportId) ?? null;
      const sla = computeSla(ageHours, appeal.status === "open" ? 8 : 24);

      queueItems.push({
        queueType: "appeal",
        id: appeal.id,
        createdAt: appeal.createdAt,
        status: appeal.status,
        ageHours,
        priorityScore: computePriorityScore({
          status: appeal.status,
          riskTier,
          ageHours,
          slaBreached: sla.breached
        }),
        riskTier,
        riskScore,
        priorityFactors: [
          `${appeal.status} status`,
          `${riskTier} trust risk`,
          sla.breached ? `SLA breached by ${sla.breachByHours}h` : `SLA due in ${sla.remainingHours}h`
        ],
        summary: shorten(appeal.reason, 200),
        sla,
        latestHandoff: handoffMap.get(`appeal:${appeal.id}`) ?? null,
        appeal: {
          appellant: appellant
            ? {
                id: appellant.id,
                handle: appellant.handle,
                role: appellant.role,
                trust: appellantTrust
              }
            : null,
          reason: appeal.reason,
          reportId: appeal.reportId,
          linkedReportStatus: linkedReport?.status ?? null
        }
      });
    }
  }

  const filtered = queueItems.filter((item) => {
    if (statuses.length > 0 && !statuses.includes(item.status)) {
      return false;
    }

    if (riskTiers.length > 0 && !riskTiers.includes(item.riskTier)) {
      return false;
    }

    if (minAgeHours !== null && item.ageHours < minAgeHours) {
      return false;
    }

    if (maxAgeHours !== null && item.ageHours > maxAgeHours) {
      return false;
    }

    return true;
  });

  filtered.sort((left, right) => {
    if (left.priorityScore !== right.priorityScore) {
      return right.priorityScore - left.priorityScore;
    }

    if (left.sla.breached !== right.sla.breached) {
      return left.sla.breached ? -1 : 1;
    }

    const leftCreatedAt = toTimestamp(left.createdAt) ?? 0;
    const rightCreatedAt = toTimestamp(right.createdAt) ?? 0;
    return leftCreatedAt - rightCreatedAt;
  });

  const queue = filtered.slice(0, limit);

  const reportQueue = queue.filter((item) => item.queueType === "report");
  const appealQueue = queue.filter((item) => item.queueType === "appeal");

  const breachedTotal = queue.filter((item) => item.sla.breached).length;
  const dueWithinHour = queue.filter((item) => !item.sla.breached && item.sla.remainingHours <= 1).length;

  const maxBreachHours = queue
    .map((item) => item.sla.breachByHours)
    .filter((value): value is number => value !== null)
    .sort((left, right) => right - left)[0] ?? null;

  return {
    generatedAt: nowIso,
    filtersApplied: {
      queue: queueFilter,
      statuses,
      riskTiers,
      minAgeHours,
      maxAgeHours,
      limit
    },
    summary: {
      totalCandidates: queueItems.length,
      returnedItems: queue.length,
      reportQueue: {
        open: reportQueue.filter((item) => item.status === "open").length,
        triaged: reportQueue.filter((item) => item.status === "triaged").length,
        breached: reportQueue.filter((item) => item.sla.breached).length
      },
      appealQueue: {
        open: appealQueue.filter((item) => item.status === "open").length,
        underReview: appealQueue.filter((item) => item.status === "under_review").length,
        breached: appealQueue.filter((item) => item.sla.breached).length
      },
      sla: {
        breachedTotal,
        dueWithinHour,
        maxBreachHours
      }
    },
    queue
  };
}
