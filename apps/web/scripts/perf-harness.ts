const PERF_TMP_DIR = ".tmp/perf-harness";
const PERF_DB_FILE = `${PERF_TMP_DIR}/store.db`;
const PERF_AUDIT_LOG = `${PERF_TMP_DIR}/audit-log.jsonl`;

process.env.HUMANONLY_DB_FILE ??= PERF_DB_FILE;
process.env.HUMANONLY_AUDIT_LOG_FILE ??= PERF_AUDIT_LOG;

const REFERENCE_TIME = "2026-03-03T00:00:00.000Z";

const TIERS = [
  { name: "baseline", concurrency: 1, requests: 60 },
  { name: "sustained", concurrency: 4, requests: 120 },
  { name: "pressure", concurrency: 8, requests: 160 }
] as const;

type TierConfig = (typeof TIERS)[number];

type SeedSnapshot = import("@/lib/seed").SeedSnapshot;

type MemberIdentity = { id: string; handle: string };

type HarnessContext = {
  members: MemberIdentity[];
  postIds: string[];
};

type HarnessResult = {
  tier: TierConfig["name"];
  endpoint: string;
  concurrency: number;
  requests: number;
  success: number;
  failure: number;
  averageLatencyMs: number;
  p50LatencyMs: number;
  p90LatencyMs: number;
  p95LatencyMs: number;
  maxLatencyMs: number;
  throughputRps: number;
  totalTimeMs: number;
  sampleError?: string;
};

type LoadSummary = {
  durations: number[];
  success: number;
  failure: number;
  errors: string[];
  totalTimeMs: number;
};

type EndpointOperation = (
  iteration: number,
  tier: TierConfig,
  context: HarnessContext
) => Promise<void>;

async function main() {
  const { mkdirSync } = await import("node:fs");
  const { resolve } = await import("node:path");

  mkdirSync(PERF_TMP_DIR, { recursive: true });

  const canonicalSnapshot = await loadSeedSnapshot();

  const { createPostRecord, createReportRecord, listFeedPage, parseCreatePostPayload, parseCreateReportPayload } =
    await import("@/lib/content");
  const { db, persistStore } = await import("@/lib/store");
  const { writeAuditStub } = await import("@/lib/audit");

  console.log("Performance harness starting");
  console.log(`  node: ${process.version}`);
  console.log(`  platform: ${process.platform}`);
  console.log(`  tmp dir: ${resolve(PERF_TMP_DIR)}`);
  console.log("  endpoints: POST /api/posts, GET /api/feed, POST /api/reports");

  const results: HarnessResult[] = [];
  const startTime = process.hrtime.bigint();

  for (const tier of TIERS) {
    console.log(`\n--- Tier ${tier.name} (concurrency=${tier.concurrency}, requests=${tier.requests}) ---`);

    for (const [endpointName, operation] of getEndpoints(
      db,
      persistStore,
      createPostRecord,
      createReportRecord,
      listFeedPage,
      parseCreatePostPayload,
      parseCreateReportPayload,
      writeAuditStub
    )) {
      restoreSnapshot(canonicalSnapshot, db);
      const context = buildContextFromStore(db);

      const summary = await runLoad(operation, tier, context);
      const stats = summarizeLatency(summary.durations);
      const throughput = tier.requests > 0 ? summary.success / ((summary.totalTimeMs / 1000) || 1) : 0;

      results.push({
        tier: tier.name,
        endpoint: endpointName,
        concurrency: tier.concurrency,
        requests: tier.requests,
        success: summary.success,
        failure: summary.failure,
        averageLatencyMs: stats.average,
        p50LatencyMs: stats.p50,
        p90LatencyMs: stats.p90,
        p95LatencyMs: stats.p95,
        maxLatencyMs: stats.max,
        throughputRps: throughput,
        totalTimeMs: summary.totalTimeMs,
        sampleError: summary.errors[0]
      });

      logSummary(endpointName, stats, throughput, summary);
    }
  }

  const overallMs = Number(process.hrtime.bigint() - startTime) / 1e6;
  console.log(`\nPerformance harness complete (${overallMs.toFixed(0)} ms total)`);
  console.table(results.map((row) => ({
    Tier: row.tier,
    Endpoint: row.endpoint,
    Concurrency: row.concurrency,
    Requests: row.requests,
    Successes: row.success,
    Failures: row.failure,
    "Avg ms": row.averageLatencyMs.toFixed(2),
    "P95 ms": row.p95LatencyMs.toFixed(2),
    "Throughput (req/s)": row.throughputRps.toFixed(1)
  })));
}

main().catch((error) => {
  console.error("Performance harness failed", error);
  process.exit(1);
});

async function loadSeedSnapshot(): Promise<SeedSnapshot> {
  const { createDefaultSeedSnapshot } = await import("@/lib/seed");
  return createDefaultSeedSnapshot(REFERENCE_TIME);
}

function restoreSnapshot(snapshot: SeedSnapshot, store: { users: any[]; posts: any[]; reports: any[]; appeals: any[] }) {
  replaceArray(store.users, snapshot.users);
  replaceArray(store.posts, snapshot.posts);
  replaceArray(store.reports, snapshot.reports);
  replaceArray(store.appeals, snapshot.appeals);
}

function replaceArray(target: any[], source: any[]) {
  target.length = 0;
  for (const entry of source) {
    target.push({ ...entry });
  }
}

function buildContextFromStore(store: { users: Array<{ id: string; handle: string; role: string }>; posts: Array<{ id: string }> }): HarnessContext {
  const members = store.users
    .filter((user) => user.role === "member")
    .map((user) => ({ id: user.id, handle: user.handle }));

  if (members.length === 0 && store.users.length > 0) {
    members.push({ id: store.users[0].id, handle: store.users[0].handle });
  }

  return {
    members,
    postIds: store.posts.map((post) => post.id)
  };
}

function getEndpoints(
  storeDb: typeof import("@/lib/store").db,
  persistStoreFn: typeof import("@/lib/store").persistStore,
  createPostRecord: typeof import("@/lib/content").createPostRecord,
  createReportRecord: typeof import("@/lib/content").createReportRecord,
  listFeedPage: typeof import("@/lib/content").listFeedPage,
  parseCreatePostPayload: typeof import("@/lib/content").parseCreatePostPayload,
  parseCreateReportPayload: typeof import("@/lib/content").parseCreateReportPayload,
  writeAuditStub: typeof import("@/lib/audit").writeAuditStub
): [string, EndpointOperation][] {
  return [
    [
      "POST /api/posts",
      async (iteration, tier, context) => {
        const author = context.members[iteration % context.members.length];
        const payload = { body: `perf-post:${tier.name}:${iteration}:${Date.now()}` };
        const command = parseCreatePostPayload(payload);
        const post = createPostRecord(storeDb, {
          authorId: author.id,
          body: command.body
        });
        persistStoreFn();

        context.postIds.unshift(post.id);

        await writeAuditStub({
          actorId: author.id,
          action: "post.created",
          targetType: "post",
          targetId: post.id,
          metadata: {
            bodyLength: post.body.length,
            authorHandle: author.handle
          },
          createdAt: new Date().toISOString()
        });
      }
    ],
    [
      "GET /api/feed",
      async (iteration, tier, context) => {
        const limit = 8 + (iteration % 8);
        const cursorCandidate =
          iteration % 3 === 0 && context.postIds.length > 0
            ? context.postIds[iteration % context.postIds.length]
            : null;
        const feed = listFeedPage(storeDb, {
          cursor: cursorCandidate,
          limit
        });

        const actor = context.members[0];
        await writeAuditStub({
          actorId: actor?.id ?? "perf-reader",
          action: "feed.requested",
          targetType: "feed",
          metadata: {
            cursor: cursorCandidate,
            limit: feed.pageInfo.limit,
            resultCount: feed.data.length,
            authenticated: !!actor
          },
          createdAt: new Date().toISOString()
        });
      }
    ],
    [
      "POST /api/reports",
      async (iteration, tier, context) => {
        const reporter = context.members[(iteration + 1) % context.members.length];
        if (context.postIds.length === 0) {
          throw new Error("No posts available for report");
        }

        const targetPost = context.postIds[iteration % context.postIds.length];
        const payload = { postId: targetPost, reason: `Performance report ${iteration}` };
        const command = parseCreateReportPayload(payload);
        const report = createReportRecord(storeDb, {
          postId: command.postId,
          reporterId: reporter.id,
          reason: command.reason
        });
        persistStoreFn();

        await writeAuditStub({
          actorId: reporter.id,
          action: "report.created",
          targetType: "report",
          targetId: report.id,
          metadata: {
            postId: report.postId,
            reasonLength: report.reason.length,
            reporterHandle: reporter.handle
          },
          createdAt: new Date().toISOString()
        });
      }
    ]
  ];
}

async function runLoad(operation: EndpointOperation, tier: TierConfig, context: HarnessContext): Promise<LoadSummary> {
  const totalRequests = tier.requests;
  const concurrency = Math.min(tier.concurrency, totalRequests);
  const stats: LoadSummary = {
    durations: [] as number[],
    success: 0,
    failure: 0,
    errors: [] as string[],
    totalTimeMs: 0
  };

  const start = process.hrtime.bigint();
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < totalRequests) {
      const current = nextIndex;
      nextIndex += 1;
      const iterationStart = process.hrtime.bigint();
      try {
        await operation(current, tier, context);
        stats.success += 1;
      } catch (error) {
        stats.failure += 1;
        stats.errors.push(error instanceof Error ? error.message : String(error));
      } finally {
        const elapsed = Number(process.hrtime.bigint() - iterationStart) / 1e6;
        stats.durations.push(elapsed);
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  stats.totalTimeMs = Number(process.hrtime.bigint() - start) / 1e6;

  return stats;
}

function summarizeLatency(durations: number[]) {
  if (durations.length === 0) {
    return { average: 0, p50: 0, p90: 0, p95: 0, max: 0 };
  }

  const sorted = [...durations].sort((a, b) => a - b);
  const sum = durations.reduce((total, value) => total + value, 0);
  const average = sum / sorted.length;
  const percentile = (percentage: number) => {
    const index = Math.min(sorted.length - 1, Math.floor((percentage / 100) * sorted.length));
    return sorted[index];
  };

  return {
    average,
    p50: percentile(50),
    p90: percentile(90),
    p95: percentile(95),
    max: sorted[sorted.length - 1]
  };
}

function logSummary(endpoint: string, stats: ReturnType<typeof summarizeLatency>, throughput: number, summary: LoadSummary) {
  console.log(`\n${endpoint}`);
  console.log(`  Success: ${summary.success}, Failure: ${summary.failure}`);
  console.log(`  Avg latency: ${stats.average.toFixed(2)} ms, p95: ${stats.p95.toFixed(2)} ms, max: ${stats.max.toFixed(2)} ms`);
  console.log(`  Throughput: ${throughput.toFixed(1)} req/s`);
  if (summary.errors.length > 0) {
    console.log(`  Sample error: ${summary.errors[0]}`);
  }
}
