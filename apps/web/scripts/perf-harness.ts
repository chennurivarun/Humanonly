const DEFAULT_PERF_TMP_DIR = ".tmp/perf-harness";
const DEFAULT_REFERENCE_TIME = "2026-03-03T00:00:00.000Z";

const TIERS = [
  { name: "baseline", concurrency: 1, requests: 60 },
  { name: "sustained", concurrency: 4, requests: 120 },
  { name: "pressure", concurrency: 8, requests: 160 }
] as const;

type TierConfig = (typeof TIERS)[number];

type AuditWriteMode = "sync" | "async";

type SeedSnapshot = import("@/lib/seed").SeedSnapshot;
type AuditRecord = import("@/lib/audit").AuditRecord;

type MemberIdentity = { id: string; handle: string };

type HarnessContext = {
  members: MemberIdentity[];
  postIds: string[];
};

type HarnessResult = {
  tier: TierConfig["name"];
  endpoint: string;
  auditMode: AuditWriteMode;
  concurrency: number;
  requests: number;
  success: number;
  failure: number;
  auditFailure: number;
  averageLatencyMs: number;
  p50LatencyMs: number;
  p90LatencyMs: number;
  p95LatencyMs: number;
  maxLatencyMs: number;
  throughputRps: number;
  totalTimeMs: number;
  sampleError?: string;
  sampleAuditError?: string;
};

type HarnessSummary = {
  generatedAt: string;
  auditMode: AuditWriteMode;
  runtime: {
    node: string;
    platform: string;
  };
  config: {
    tmpDir: string;
    dbFile: string;
    auditLogFile: string;
    referenceTime: string;
    tiers: ReadonlyArray<TierConfig>;
  };
  results: HarnessResult[];
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

type CliOptions = {
  auditMode: AuditWriteMode;
  jsonOutput?: string;
  referenceTime: string;
  silent: boolean;
};

async function main() {
  const options = parseCliOptions(process.argv.slice(2));
  const summary = await runPerformanceHarness(options);

  if (options.jsonOutput) {
    const { mkdirSync, writeFileSync } = await import("node:fs");
    const { dirname, resolve } = await import("node:path");

    const resolvedOutput = resolve(options.jsonOutput);
    mkdirSync(dirname(resolvedOutput), { recursive: true });
    writeFileSync(resolvedOutput, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

    if (!options.silent) {
      console.log(`\nSaved harness summary JSON to ${resolvedOutput}`);
    }
  }
}

main().catch((error) => {
  console.error("Performance harness failed", error);
  process.exit(1);
});

async function runPerformanceHarness(options: CliOptions): Promise<HarnessSummary> {
  const { mkdirSync } = await import("node:fs");
  const { dirname, resolve } = await import("node:path");

  const perfTmpDir = process.env.HUMANONLY_PERF_TMP_DIR?.trim() || DEFAULT_PERF_TMP_DIR;
  const defaultDbFile = `${perfTmpDir}/${options.auditMode}/store.db`;
  const defaultAuditLog = `${perfTmpDir}/${options.auditMode}/audit-log.jsonl`;

  process.env.HUMANONLY_DB_FILE = process.env.HUMANONLY_DB_FILE?.trim() || defaultDbFile;
  process.env.HUMANONLY_AUDIT_LOG_FILE = process.env.HUMANONLY_AUDIT_LOG_FILE?.trim() || defaultAuditLog;
  process.env.HUMANONLY_AUDIT_WRITE_MODE = options.auditMode;

  mkdirSync(perfTmpDir, { recursive: true });
  mkdirSync(dirname(resolve(process.env.HUMANONLY_DB_FILE)), { recursive: true });
  mkdirSync(dirname(resolve(process.env.HUMANONLY_AUDIT_LOG_FILE)), { recursive: true });

  const canonicalSnapshot = await loadSeedSnapshot(options.referenceTime);

  const {
    createPostRecord,
    createReportRecord,
    listFeedPage,
    parseCreatePostPayload,
    parseCreateReportPayload
  } = await import("@/lib/content");
  const { db, persistStore, storeReady, waitForStorePersistence } = await import("@/lib/store");
  const { resetAuditStateForTests, waitForAuditDrain, writeAuditStub } = await import("@/lib/audit");

  await storeReady;
  resetAuditStateForTests();

  if (!options.silent) {
    console.log("Performance harness starting");
    console.log(`  audit mode: ${options.auditMode}`);
    console.log(`  node: ${process.version}`);
    console.log(`  platform: ${process.platform}`);
    console.log(`  tmp dir: ${resolve(perfTmpDir)}`);
    console.log(`  db file: ${resolve(process.env.HUMANONLY_DB_FILE)}`);
    console.log(`  audit log: ${resolve(process.env.HUMANONLY_AUDIT_LOG_FILE)}`);
    console.log("  endpoints: POST /api/posts, GET /api/feed, POST /api/reports");
  }

  const asyncAuditErrors: string[] = [];
  const results: HarnessResult[] = [];
  const startTime = process.hrtime.bigint();

  for (const tier of TIERS) {
    if (!options.silent) {
      console.log(`\n--- Tier ${tier.name} (concurrency=${tier.concurrency}, requests=${tier.requests}) ---`);
    }

    for (const [endpointName, operation] of getEndpoints(
      options.auditMode,
      asyncAuditErrors,
      db,
      persistStore,
      waitForStorePersistence,
      createPostRecord,
      createReportRecord,
      listFeedPage,
      parseCreatePostPayload,
      parseCreateReportPayload,
      writeAuditStub
    )) {
      restoreSnapshot(canonicalSnapshot, db);
      const context = buildContextFromStore(db);
      const auditErrorStart = asyncAuditErrors.length;

      const summary = await runLoad(operation, tier, context);
      await waitForAuditDrain();

      const endpointAuditErrors = asyncAuditErrors.slice(auditErrorStart);
      const stats = summarizeLatency(summary.durations);
      const throughput = tier.requests > 0 ? summary.success / ((summary.totalTimeMs / 1000) || 1) : 0;

      const result: HarnessResult = {
        tier: tier.name,
        endpoint: endpointName,
        auditMode: options.auditMode,
        concurrency: tier.concurrency,
        requests: tier.requests,
        success: summary.success,
        failure: summary.failure,
        auditFailure: endpointAuditErrors.length,
        averageLatencyMs: stats.average,
        p50LatencyMs: stats.p50,
        p90LatencyMs: stats.p90,
        p95LatencyMs: stats.p95,
        maxLatencyMs: stats.max,
        throughputRps: throughput,
        totalTimeMs: summary.totalTimeMs,
        sampleError: summary.errors[0],
        sampleAuditError: endpointAuditErrors[0]
      };

      results.push(result);

      if (!options.silent) {
        logSummary(result);
      }
    }
  }

  await waitForAuditDrain();

  const overallMs = Number(process.hrtime.bigint() - startTime) / 1e6;
  if (!options.silent) {
    console.log(`\nPerformance harness complete (${overallMs.toFixed(0)} ms total)`);
    console.table(
      results.map((row) => ({
        Tier: row.tier,
        Endpoint: row.endpoint,
        "Audit mode": row.auditMode,
        Concurrency: row.concurrency,
        Requests: row.requests,
        Successes: row.success,
        Failures: row.failure,
        "Audit failures": row.auditFailure,
        "Avg ms": row.averageLatencyMs.toFixed(2),
        "P95 ms": row.p95LatencyMs.toFixed(2),
        "Throughput (req/s)": row.throughputRps.toFixed(1)
      }))
    );
  }

  return {
    generatedAt: new Date().toISOString(),
    auditMode: options.auditMode,
    runtime: {
      node: process.version,
      platform: process.platform
    },
    config: {
      tmpDir: resolve(perfTmpDir),
      dbFile: resolve(process.env.HUMANONLY_DB_FILE),
      auditLogFile: resolve(process.env.HUMANONLY_AUDIT_LOG_FILE),
      referenceTime: options.referenceTime,
      tiers: TIERS
    },
    results
  };
}

function parseCliOptions(args: string[]): CliOptions {
  const modeArg = readCliValue(args, "--audit-mode") ?? process.env.HUMANONLY_AUDIT_WRITE_MODE ?? "sync";
  const auditMode = normalizeAuditMode(modeArg);

  return {
    auditMode,
    jsonOutput: readCliValue(args, "--json-output"),
    referenceTime: readCliValue(args, "--reference-time") ?? DEFAULT_REFERENCE_TIME,
    silent: hasCliFlag(args, "--silent")
  };
}

function readCliValue(args: string[], flag: string): string | undefined {
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token) {
      continue;
    }

    if (token === flag) {
      const next = args[index + 1];
      if (next && !next.startsWith("--")) {
        return next;
      }
      return undefined;
    }

    const prefix = `${flag}=`;
    if (token.startsWith(prefix)) {
      return token.slice(prefix.length);
    }
  }

  return undefined;
}

function hasCliFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

function normalizeAuditMode(value: string): AuditWriteMode {
  const normalized = value.trim().toLowerCase();
  if (normalized === "sync" || normalized === "async") {
    return normalized;
  }

  throw new Error(`Unsupported --audit-mode value: ${value}`);
}

async function loadSeedSnapshot(referenceTime: string): Promise<SeedSnapshot> {
  const { createDefaultSeedSnapshot } = await import("@/lib/seed");
  return createDefaultSeedSnapshot(referenceTime);
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
  auditMode: AuditWriteMode,
  asyncAuditErrors: string[],
  storeDb: typeof import("@/lib/store").db,
  persistStoreFn: typeof import("@/lib/store").persistStore,
  waitForStorePersistence: typeof import("@/lib/store").waitForStorePersistence,
  createPostRecord: typeof import("@/lib/content").createPostRecord,
  createReportRecord: typeof import("@/lib/content").createReportRecord,
  listFeedPage: typeof import("@/lib/content").listFeedPage,
  parseCreatePostPayload: typeof import("@/lib/content").parseCreatePostPayload,
  parseCreateReportPayload: typeof import("@/lib/content").parseCreateReportPayload,
  writeAuditStub: typeof import("@/lib/audit").writeAuditStub
): [string, EndpointOperation][] {
  const writeAuditByMode = async (record: AuditRecord) => {
    if (auditMode === "sync") {
      await writeAuditStub(record);
      return;
    }

    void writeAuditStub(record).catch((error) => {
      asyncAuditErrors.push(error instanceof Error ? error.message : String(error));
    });
  };

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
        await waitForStorePersistence();

        context.postIds.unshift(post.id);

        await writeAuditByMode({
          actorId: author.id,
          action: "post.created",
          targetType: "post",
          targetId: post.id,
          metadata: {
            bodyLength: post.body.length,
            authorHandle: author.handle,
            auditMode
          },
          createdAt: new Date().toISOString()
        });
      }
    ],
    [
      "GET /api/feed",
      async (iteration, _tier, context) => {
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
            authenticated: !!actor,
            auditMode: "sync"
          },
          createdAt: new Date().toISOString()
        });
      }
    ],
    [
      "POST /api/reports",
      async (iteration, _tier, context) => {
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
        await waitForStorePersistence();

        await writeAuditByMode({
          actorId: reporter.id,
          action: "report.created",
          targetType: "report",
          targetId: report.id,
          metadata: {
            postId: report.postId,
            reasonLength: report.reason.length,
            reporterHandle: reporter.handle,
            auditMode
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

function logSummary(result: HarnessResult) {
  console.log(`\n${result.endpoint}`);
  console.log(`  Success: ${result.success}, Failure: ${result.failure}, Audit failures: ${result.auditFailure}`);
  console.log(
    `  Avg latency: ${result.averageLatencyMs.toFixed(2)} ms, p95: ${result.p95LatencyMs.toFixed(2)} ms, max: ${result.maxLatencyMs.toFixed(2)} ms`
  );
  console.log(`  Throughput: ${result.throughputRps.toFixed(1)} req/s`);

  if (result.sampleError) {
    console.log(`  Sample error: ${result.sampleError}`);
  }

  if (result.sampleAuditError) {
    console.log(`  Sample audit error: ${result.sampleAuditError}`);
  }
}
