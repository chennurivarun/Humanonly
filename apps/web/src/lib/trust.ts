import type { IdentityProfile, Post, Report } from "@/lib/store";

export type TrustEvent = {
  code: "BASELINE" | "POST_PUBLISHED" | "REPORT_FILED" | "REPORT_AGAINST_OPEN" | "REPORT_AGAINST_RESOLVED";
  delta: number;
  reason: string;
};

export type TrustScore = {
  userId: string;
  score: number;
  tier: "restricted" | "watch" | "steady" | "trusted";
  rationale: TrustEvent[];
  computedAt: string;
};

type TrustStore = {
  users: IdentityProfile[];
  posts: Post[];
  reports: Report[];
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function tierFor(score: number): TrustScore["tier"] {
  if (score >= 80) return "trusted";
  if (score >= 50) return "steady";
  if (score >= 30) return "watch";
  return "restricted";
}

export function computeTrustScore(
  store: TrustStore,
  userId: string,
  nowIso = new Date().toISOString()
): TrustScore {
  const rationale: TrustEvent[] = [
    {
      code: "BASELINE",
      delta: 50,
      reason: "Initial trust baseline for verified humans"
    }
  ];

  const authoredPosts = store.posts.filter((post) => post.authorId === userId);
  if (authoredPosts.length > 0) {
    const contributionDelta = Math.min(authoredPosts.length, 10);
    rationale.push({
      code: "POST_PUBLISHED",
      delta: contributionDelta,
      reason: `Published ${authoredPosts.length} post(s)`
    });
  }

  const reportsFiled = store.reports.filter((report) => report.reporterId === userId);
  if (reportsFiled.length > 0) {
    const filingDelta = Math.min(reportsFiled.length, 5);
    rationale.push({
      code: "REPORT_FILED",
      delta: filingDelta,
      reason: `Filed ${reportsFiled.length} moderation report(s)`
    });
  }

  const reportsAgainst = store.reports.filter((report) => {
    const post = store.posts.find((candidate) => candidate.id === report.postId);
    return post?.authorId === userId;
  });

  const openAgainst = reportsAgainst.filter((report) => report.status !== "resolved").length;
  if (openAgainst > 0) {
    rationale.push({
      code: "REPORT_AGAINST_OPEN",
      delta: openAgainst * -8,
      reason: `${openAgainst} open report(s) against authored content`
    });
  }

  const resolvedAgainst = reportsAgainst.filter((report) => report.status === "resolved").length;
  if (resolvedAgainst > 0) {
    rationale.push({
      code: "REPORT_AGAINST_RESOLVED",
      delta: resolvedAgainst * -2,
      reason: `${resolvedAgainst} resolved report(s) against authored content`
    });
  }

  const score = clamp(rationale.reduce((sum, item) => sum + item.delta, 0), 0, 100);

  return {
    userId,
    score,
    tier: tierFor(score),
    rationale,
    computedAt: nowIso
  };
}

export function listTrustScores(store: TrustStore, nowIso = new Date().toISOString()): TrustScore[] {
  return store.users.map((user) => computeTrustScore(store, user.id, nowIso));
}
