import { listTrustScores } from "@/lib/trust";
import type { Appeal, IdentityProfile, Post, Report } from "@/lib/store";

export type AdminMetrics = {
  generatedAt: string;
  reports: {
    total: number;
    open: number;
    triaged: number;
    resolved: number;
    queueThroughputPercent: number;
  };
  appeals: {
    total: number;
    open: number;
    underReview: number;
    granted: number;
    upheld: number;
    medianResolutionHours: number | null;
  };
  trust: {
    averageScore: number;
    restricted: number;
    watch: number;
    steady: number;
    trusted: number;
  };
  overrides: {
    total: number;
    overrideRatePercent: number;
  };
};

type AdminMetricsStore = {
  users: IdentityProfile[];
  posts: Post[];
  reports: Report[];
  appeals: Appeal[];
};

function round(value: number, digits = 1): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function median(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return round(((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2, 2);
  }

  return round(sorted[middle] ?? 0, 2);
}

export function buildAdminMetrics(store: AdminMetricsStore, nowIso = new Date().toISOString()): AdminMetrics {
  const reports = {
    total: store.reports.length,
    open: store.reports.filter((report) => report.status === "open").length,
    triaged: store.reports.filter((report) => report.status === "triaged").length,
    resolved: store.reports.filter((report) => report.status === "resolved").length,
    queueThroughputPercent: 0
  };

  reports.queueThroughputPercent =
    reports.total === 0 ? 0 : round((reports.resolved / reports.total) * 100, 1);

  const resolvedAppealDurationsHours = store.appeals
    .filter((appeal) => Boolean(appeal.decidedAt))
    .map((appeal) => {
      const createdAtMs = Date.parse(appeal.createdAt);
      const decidedAtMs = Date.parse(appeal.decidedAt as string);
      if (Number.isNaN(createdAtMs) || Number.isNaN(decidedAtMs) || decidedAtMs < createdAtMs) {
        return null;
      }

      return (decidedAtMs - createdAtMs) / (1000 * 60 * 60);
    })
    .filter((value): value is number => value !== null);

  const appeals = {
    total: store.appeals.length,
    open: store.appeals.filter((appeal) => appeal.status === "open").length,
    underReview: store.appeals.filter((appeal) => appeal.status === "under_review").length,
    granted: store.appeals.filter((appeal) => appeal.status === "granted").length,
    upheld: store.appeals.filter((appeal) => appeal.status === "upheld").length,
    medianResolutionHours: median(resolvedAppealDurationsHours)
  };

  const trustScores = listTrustScores(store, nowIso);
  const totalTrustScore = trustScores.reduce((sum, item) => sum + item.score, 0);

  const trust = {
    averageScore: trustScores.length === 0 ? 0 : round(totalTrustScore / trustScores.length, 1),
    restricted: trustScores.filter((entry) => entry.tier === "restricted").length,
    watch: trustScores.filter((entry) => entry.tier === "watch").length,
    steady: trustScores.filter((entry) => entry.tier === "steady").length,
    trusted: trustScores.filter((entry) => entry.tier === "trusted").length
  };

  const overridesTotal = store.reports.filter((report) => report.status !== "open").length;
  const overrides = {
    total: overridesTotal,
    overrideRatePercent: reports.total === 0 ? 0 : round((overridesTotal / reports.total) * 100, 1)
  };

  return {
    generatedAt: nowIso,
    reports,
    appeals,
    trust,
    overrides
  };
}
