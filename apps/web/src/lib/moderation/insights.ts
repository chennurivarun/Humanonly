import { buildModerationActionLog, type ModerationActionLogEntry } from "@/lib/moderation/action-log";
import { computeTrustScore, type TrustScore } from "@/lib/trust";
import type { Appeal, IdentityProfile, Post, Report } from "@/lib/store";

export type ModerationInsightsTrend = {
  windowDays: number;
  reportsCreated: number;
  reportsResolved: number;
  queueThroughputPercent: number;
  appealsCreated: number;
  appealsResolved: number;
  medianAppealResolutionHours: number | null;
  activeUsers: number;
  activeAverageTrustScore: number;
  activeTrustByTier: {
    restricted: number;
    watch: number;
    steady: number;
    trusted: number;
  };
};

export type ModerationQueueReportInsight = {
  id: string;
  createdAt: string;
  status: Report["status"];
  reason: string;
  post: {
    id: string;
    preview: string;
  } | null;
  reporter: {
    id: string;
    handle: string;
    role: IdentityProfile["role"];
  } | null;
  author: {
    id: string;
    handle: string;
    role: IdentityProfile["role"];
  } | null;
  reporterTrust: TrustScore | null;
  authorTrust: TrustScore | null;
};

export type ModerationQueueAppealInsight = {
  id: string;
  reportId: string;
  createdAt: string;
  updatedAt: string;
  status: Appeal["status"];
  reason: string;
  appellant: {
    id: string;
    handle: string;
    role: IdentityProfile["role"];
  } | null;
  appellantTrust: TrustScore | null;
  linkedReportStatus: Report["status"] | null;
};

export type ModerationTrustWatchlistEntry = {
  user: {
    id: string;
    handle: string;
    role: IdentityProfile["role"];
  };
  trust: TrustScore;
};

export type ModerationInsights = {
  generatedAt: string;
  queueHealth: {
    openReports: number;
    triagedReports: number;
    openAppeals: number;
    underReviewAppeals: number;
    oldestOpenReportAgeHours: number | null;
    oldestOpenAppealAgeHours: number | null;
  };
  trends: ModerationInsightsTrend[];
  reports: ModerationQueueReportInsight[];
  appeals: ModerationQueueAppealInsight[];
  trustWatchlist: ModerationTrustWatchlistEntry[];
  recentActionLog: {
    chain: { valid: true } | { valid: false; reason: string };
    entries: ModerationActionLogEntry[];
  };
};

type InsightsStore = {
  users: IdentityProfile[];
  posts: Post[];
  reports: Report[];
  appeals: Appeal[];
};

export type BuildModerationInsightsOptions = {
  nowIso?: string;
  queueLimit?: number;
  trustWatchlistLimit?: number;
  actionLogLimit?: number;
  trendWindowsDays?: number[];
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

function toTimestamp(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function clampLimit(value: number | undefined, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  const rounded = Math.floor(value as number);
  return Math.min(Math.max(rounded, min), max);
}

function normalizeTrendWindows(value: number[] | undefined): number[] {
  if (!value || value.length === 0) {
    return [7, 30];
  }

  const cleaned = Array.from(
    new Set(
      value
        .map((days) => Math.floor(days))
        .filter((days) => Number.isFinite(days) && days >= 1 && days <= 365)
    )
  );

  if (cleaned.length === 0) {
    return [7, 30];
  }

  return cleaned.sort((left, right) => left - right);
}

function byNewestTimestamp<T extends { createdAt: string }>(items: T[]): T[] {
  return [...items].sort((left, right) => {
    const leftTs = toTimestamp(left.createdAt) ?? 0;
    const rightTs = toTimestamp(right.createdAt) ?? 0;
    return rightTs - leftTs;
  });
}

function shorten(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(maxLength - 1, 1)).trimEnd()}…`;
}

export function buildModerationInsights(
  store: InsightsStore,
  options: BuildModerationInsightsOptions = {}
): ModerationInsights {
  const nowIso = options.nowIso ?? new Date().toISOString();
  const nowMs = Date.parse(nowIso);
  const queueLimit = clampLimit(options.queueLimit, 25, 1, 100);
  const trustWatchlistLimit = clampLimit(options.trustWatchlistLimit, 10, 1, 50);
  const actionLogLimit = clampLimit(options.actionLogLimit, 20, 1, 200);
  const trendWindowsDays = normalizeTrendWindows(options.trendWindowsDays);

  const trustCache = new Map<string, TrustScore>();
  function trustFor(userId: string | undefined): TrustScore | null {
    if (!userId) {
      return null;
    }

    if (trustCache.has(userId)) {
      return trustCache.get(userId) ?? null;
    }

    const userExists = store.users.some((user) => user.id === userId);
    if (!userExists) {
      return null;
    }

    const trust = computeTrustScore(store, userId, nowIso);
    trustCache.set(userId, trust);
    return trust;
  }

  const userById = new Map(store.users.map((user) => [user.id, user]));
  const postById = new Map(store.posts.map((post) => [post.id, post]));
  const reportById = new Map(store.reports.map((report) => [report.id, report]));

  const queuedReports = byNewestTimestamp(store.reports.filter((report) => report.status !== "resolved")).slice(0, queueLimit);
  const queuedAppeals = byNewestTimestamp(
    store.appeals.filter((appeal) => appeal.status === "open" || appeal.status === "under_review")
  ).slice(0, queueLimit);

  const reports = queuedReports.map<ModerationQueueReportInsight>((report) => {
    const reporter = userById.get(report.reporterId) ?? null;
    const post = postById.get(report.postId) ?? null;
    const author = post ? (userById.get(post.authorId) ?? null) : null;

    return {
      id: report.id,
      createdAt: report.createdAt,
      status: report.status,
      reason: report.reason,
      post: post
        ? {
            id: post.id,
            preview: shorten(post.body, 120)
          }
        : null,
      reporter: reporter
        ? {
            id: reporter.id,
            handle: reporter.handle,
            role: reporter.role
          }
        : null,
      author: author
        ? {
            id: author.id,
            handle: author.handle,
            role: author.role
          }
        : null,
      reporterTrust: trustFor(reporter?.id),
      authorTrust: trustFor(author?.id)
    };
  });

  const appeals = queuedAppeals.map<ModerationQueueAppealInsight>((appeal) => {
    const appellant = userById.get(appeal.appellantId) ?? null;
    const linkedReport = reportById.get(appeal.reportId) ?? null;

    return {
      id: appeal.id,
      reportId: appeal.reportId,
      createdAt: appeal.createdAt,
      updatedAt: appeal.updatedAt,
      status: appeal.status,
      reason: appeal.reason,
      appellant: appellant
        ? {
            id: appellant.id,
            handle: appellant.handle,
            role: appellant.role
          }
        : null,
      appellantTrust: trustFor(appellant?.id),
      linkedReportStatus: linkedReport?.status ?? null
    };
  });

  const reportsOpen = store.reports.filter((report) => report.status === "open");
  const reportsTriaged = store.reports.filter((report) => report.status === "triaged");
  const appealsOpen = store.appeals.filter((appeal) => appeal.status === "open");
  const appealsUnderReview = store.appeals.filter((appeal) => appeal.status === "under_review");

  const oldestOpenReportAgeHours = (() => {
    if (reportsOpen.length === 0 || Number.isNaN(nowMs)) {
      return null;
    }

    const oldestCreatedAt = Math.min(
      ...reportsOpen
        .map((report) => toTimestamp(report.createdAt))
        .filter((value): value is number => value !== null)
    );

    if (!Number.isFinite(oldestCreatedAt)) {
      return null;
    }

    return round((nowMs - oldestCreatedAt) / (1000 * 60 * 60), 1);
  })();

  const oldestOpenAppealAgeHours = (() => {
    if (appealsOpen.length === 0 || Number.isNaN(nowMs)) {
      return null;
    }

    const oldestCreatedAt = Math.min(
      ...appealsOpen
        .map((appeal) => toTimestamp(appeal.createdAt))
        .filter((value): value is number => value !== null)
    );

    if (!Number.isFinite(oldestCreatedAt)) {
      return null;
    }

    return round((nowMs - oldestCreatedAt) / (1000 * 60 * 60), 1);
  })();

  const trends = trendWindowsDays.map<ModerationInsightsTrend>((windowDays) => {
    const cutoffMs = Number.isNaN(nowMs) ? Number.NEGATIVE_INFINITY : nowMs - windowDays * 24 * 60 * 60 * 1000;

    const reportsCreated = store.reports.filter((report) => (toTimestamp(report.createdAt) ?? Number.NEGATIVE_INFINITY) >= cutoffMs);
    const reportsResolved = reportsCreated.filter((report) => report.status === "resolved");

    const appealsCreated = store.appeals.filter((appeal) => (toTimestamp(appeal.createdAt) ?? Number.NEGATIVE_INFINITY) >= cutoffMs);
    const appealsResolved = store.appeals.filter((appeal) => {
      if (!appeal.decidedAt) {
        return false;
      }

      return (toTimestamp(appeal.decidedAt) ?? Number.NEGATIVE_INFINITY) >= cutoffMs;
    });

    const medianAppealResolutionHours = median(
      appealsResolved
        .map((appeal) => {
          if (!appeal.decidedAt) {
            return null;
          }

          const createdAtMs = toTimestamp(appeal.createdAt);
          const decidedAtMs = toTimestamp(appeal.decidedAt);

          if (createdAtMs === null || decidedAtMs === null || decidedAtMs < createdAtMs) {
            return null;
          }

          return (decidedAtMs - createdAtMs) / (1000 * 60 * 60);
        })
        .filter((value): value is number => value !== null)
    );

    const activeUserIds = new Set<string>();

    for (const post of store.posts) {
      if ((toTimestamp(post.createdAt) ?? Number.NEGATIVE_INFINITY) >= cutoffMs) {
        activeUserIds.add(post.authorId);
      }
    }

    for (const report of reportsCreated) {
      activeUserIds.add(report.reporterId);
      const reportedPost = postById.get(report.postId);
      if (reportedPost) {
        activeUserIds.add(reportedPost.authorId);
      }
    }

    for (const appeal of appealsCreated) {
      activeUserIds.add(appeal.appellantId);
    }

    const activeTrust = Array.from(activeUserIds)
      .map((userId) => trustFor(userId))
      .filter((value): value is TrustScore => value !== null);

    const totalActiveTrustScore = activeTrust.reduce((sum, item) => sum + item.score, 0);

    return {
      windowDays,
      reportsCreated: reportsCreated.length,
      reportsResolved: reportsResolved.length,
      queueThroughputPercent:
        reportsCreated.length === 0 ? 0 : round((reportsResolved.length / reportsCreated.length) * 100, 1),
      appealsCreated: appealsCreated.length,
      appealsResolved: appealsResolved.length,
      medianAppealResolutionHours,
      activeUsers: activeTrust.length,
      activeAverageTrustScore:
        activeTrust.length === 0 ? 0 : round(totalActiveTrustScore / activeTrust.length, 1),
      activeTrustByTier: {
        restricted: activeTrust.filter((trust) => trust.tier === "restricted").length,
        watch: activeTrust.filter((trust) => trust.tier === "watch").length,
        steady: activeTrust.filter((trust) => trust.tier === "steady").length,
        trusted: activeTrust.filter((trust) => trust.tier === "trusted").length
      }
    };
  });

  const trustWatchlist = store.users
    .map<ModerationTrustWatchlistEntry>((user) => ({
      user: {
        id: user.id,
        handle: user.handle,
        role: user.role
      },
      trust: trustFor(user.id) as TrustScore
    }))
    .sort((left, right) => {
      if (left.trust.score !== right.trust.score) {
        return left.trust.score - right.trust.score;
      }

      return left.user.handle.localeCompare(right.user.handle);
    })
    .slice(0, trustWatchlistLimit);

  const recentActionLog = buildModerationActionLog(store, {
    limit: actionLogLimit
  });

  return {
    generatedAt: nowIso,
    queueHealth: {
      openReports: reportsOpen.length,
      triagedReports: reportsTriaged.length,
      openAppeals: appealsOpen.length,
      underReviewAppeals: appealsUnderReview.length,
      oldestOpenReportAgeHours,
      oldestOpenAppealAgeHours
    },
    trends,
    reports,
    appeals,
    trustWatchlist,
    recentActionLog: {
      chain: recentActionLog.chain,
      entries: recentActionLog.entries
    }
  };
}
