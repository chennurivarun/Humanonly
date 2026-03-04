import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, relative, resolve } from "node:path";
import { Pool } from "pg";
import { GOVERNANCE_ASSERTIONS, type GovernedStore } from "@/lib/governed-store";
import type { Appeal, IdentityProfile, Post, Report } from "@/lib/store";
import {
  renderIncrementalValidationMarkdown,
  summarizeScenario,
  withRedactedUrl,
  type IterationSample,
  type ValidationMode
} from "@/lib/postgres-incremental-benchmark";
import { resolvePostgresPoolPolicy } from "@/lib/storage/postgres-pool";
import { PostgresStorageAdapter } from "@/lib/storage/postgres";

type PostgresSource = "cli" | "env" | "embedded";

type PostgresRuntime = {
  source: PostgresSource;
  url: string;
  cleanup: () => Promise<void>;
};

type DatasetConfig = {
  users: number;
  posts: number;
  reports: number;
  appeals: number;
  iterations: number;
};

type QueryCounters = {
  totalQueries: number;
  mutatingQueries: number;
};

const DEFAULT_TMP_DIR = ".tmp/perf-postgres-managed";
const DEFAULT_MARKDOWN_PATH = "docs/SPRINT_6_MANAGED_POSTGRES_INCREMENTAL_VALIDATION.md";
const DEFAULT_JSON_PATH = ".tmp/perf-postgres-managed/report.json";

function parseArg(flag: string): string | undefined {
  const idx = process.argv.findIndex((token) => token === flag || token.startsWith(`${flag}=`));
  if (idx === -1) return undefined;

  const token = process.argv[idx];
  if (token?.includes("=")) {
    return token.split("=").slice(1).join("=");
  }

  const next = process.argv[idx + 1];
  return next && !next.startsWith("--") ? next : undefined;
}

function parseIntArg(flag: string, fallback: number, min: number, max: number): number {
  const raw = parseArg(flag);
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${flag} must be an integer between ${min} and ${max}`);
  }
  return value;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag) || parseArg(flag) !== undefined;
}

function usage(): string {
  return [
    "Usage:",
    "  npm run perf:postgres-managed -w apps/web -- --execute --human-approval-ref=CHANGE-123 [--postgres-url=postgres://...]",
    "",
    "Optional:",
    "  --simulated-latency-ms=12",
    "  --pool-size=20",
    "  --users=40 --posts=240 --reports=240 --appeals=80 --iterations=24",
    "  --json-output=.tmp/perf-postgres-managed/report.json",
    `  --markdown-output=${DEFAULT_MARKDOWN_PATH}`,
    "",
    "Governance:",
    "  - requires --execute and --human-approval-ref",
    "  - writes deterministic JSON + Markdown artifacts"
  ].join("\n");
}

async function sleep(ms: number): Promise<void> {
  if (ms <= 0) return;
  await new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function toQueryText(text: unknown): string {
  if (typeof text === "string") return text;
  if (text && typeof text === "object" && "text" in text) {
    const candidate = (text as { text?: unknown }).text;
    return typeof candidate === "string" ? candidate : "";
  }
  return "";
}

class QueryProbe {
  private counters: QueryCounters = {
    totalQueries: 0,
    mutatingQueries: 0
  };

  reset(): void {
    this.counters = {
      totalQueries: 0,
      mutatingQueries: 0
    };
  }

  record(text: unknown): void {
    const sql = toQueryText(text).trimStart().toUpperCase();
    this.counters.totalQueries += 1;
    if (sql.startsWith("INSERT") || sql.startsWith("UPDATE") || sql.startsWith("DELETE")) {
      this.counters.mutatingQueries += 1;
    }
  }

  snapshot(): QueryCounters {
    return { ...this.counters };
  }
}

class InstrumentedClient {
  constructor(
    private readonly baseClient: {
      query: (text: unknown, values?: unknown[]) => Promise<unknown>;
      release: () => void;
    },
    private readonly simulatedLatencyMs: number,
    private readonly probe: QueryProbe
  ) {}

  async query(text: unknown, values?: unknown[]): Promise<unknown> {
    await sleep(this.simulatedLatencyMs);
    this.probe.record(text);
    return this.baseClient.query(text, values);
  }

  release(): void {
    this.baseClient.release();
  }
}

class InstrumentedPool {
  constructor(
    private readonly basePool: Pool,
    private readonly simulatedLatencyMs: number,
    private readonly probe: QueryProbe
  ) {}

  async query(text: unknown, values?: unknown[]): Promise<unknown> {
    await sleep(this.simulatedLatencyMs);
    this.probe.record(text);
    return this.basePool.query(text as string, values as unknown[]);
  }

  async connect(): Promise<InstrumentedClient> {
    const client = await this.basePool.connect();
    return new InstrumentedClient(client, this.simulatedLatencyMs, this.probe);
  }

  async end(): Promise<void> {
    await this.basePool.end();
  }
}

async function findAvailablePort(portHint = 0): Promise<number> {
  return await new Promise<number>((resolvePort, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(portHint, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Failed to resolve an available localhost port"));
        return;
      }

      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }
        resolvePort(address.port);
      });
    });
  });
}

async function startEmbeddedPostgres(tmpDir: string): Promise<PostgresRuntime> {
  let EmbeddedPostgresCtor: new (options: Record<string, unknown>) => {
    initialise: () => Promise<void>;
    start: () => Promise<void>;
    createDatabase: (database: string) => Promise<void>;
    stop: () => Promise<void>;
  };

  try {
    const embeddedPostgres = await import("embedded-postgres");
    EmbeddedPostgresCtor = embeddedPostgres.default as typeof EmbeddedPostgresCtor;
  } catch (error) {
    throw new Error(
      `No postgres URL configured and embedded-postgres failed to load. Cause: ${(error as Error).message}`
    );
  }

  const rootDir = resolve(`${tmpDir}/embedded-postgres`);
  const dataDir = resolve(`${rootDir}/data`);
  const user = "humanonly_runner";
  const password = "humanonly_runner";
  const database = "humanonly_incremental";
  const port = await findAvailablePort(0);

  rmSync(rootDir, { recursive: true, force: true });
  mkdirSync(rootDir, { recursive: true });

  const embedded = new EmbeddedPostgresCtor({
    databaseDir: dataDir,
    user,
    password,
    port,
    persistent: false,
    onLog: () => undefined,
    onError: (message: unknown) => {
      const text = typeof message === "string" ? message : JSON.stringify(message);
      console.error(`[embedded-postgres] ${text}`);
    }
  });

  await embedded.initialise();
  await embedded.start();
  await embedded.createDatabase(database);

  const url = `postgres://${user}:${encodeURIComponent(password)}@127.0.0.1:${port}/${database}`;

  return {
    source: "embedded",
    url,
    cleanup: async () => {
      await embedded.stop();
      rmSync(rootDir, { recursive: true, force: true });
    }
  };
}

async function resolvePostgresRuntime(tmpDir: string): Promise<PostgresRuntime> {
  const cliUrl = parseArg("--postgres-url")?.trim();
  if (cliUrl) {
    return {
      source: "cli",
      url: cliUrl,
      cleanup: async () => undefined
    };
  }

  const envUrl = process.env.HUMANONLY_POSTGRES_URL?.trim();
  if (envUrl) {
    return {
      source: "env",
      url: envUrl,
      cleanup: async () => undefined
    };
  }

  return startEmbeddedPostgres(tmpDir);
}

function cloneStore(store: GovernedStore): GovernedStore {
  return {
    users: store.users.map((entry) => ({ ...entry })),
    posts: store.posts.map((entry) => ({ ...entry })),
    reports: store.reports.map((entry) => ({ ...entry })),
    appeals: store.appeals.map((entry) => ({ ...entry }))
  };
}

function isoAt(baseMs: number, offsetSeconds: number): string {
  return new Date(baseMs + offsetSeconds * 1000).toISOString();
}

function createBaselineStore(dataset: DatasetConfig): GovernedStore {
  const baseMs = Date.parse("2026-03-04T00:00:00.000Z");

  const users: IdentityProfile[] = Array.from({ length: dataset.users }, (_, idx) => {
    const role: IdentityProfile["role"] = idx === 0 ? "admin" : idx < 4 ? "moderator" : "member";
    return {
      id: `usr_${idx + 1}`,
      handle: `bench_user_${idx + 1}`,
      displayName: `Bench User ${idx + 1}`,
      role,
      governanceAcceptedAt: isoAt(baseMs, idx),
      humanVerifiedAt: isoAt(baseMs, idx + 1),
      createdAt: isoAt(baseMs, idx + 2),
      updatedAt: isoAt(baseMs, idx + 2)
    };
  });

  const posts: Post[] = Array.from({ length: dataset.posts }, (_, idx) => {
    const author = users[idx % users.length];
    return {
      id: `pst_${idx + 1}`,
      authorId: author!.id,
      body: `baseline post body ${idx + 1}`,
      createdAt: isoAt(baseMs, 500 + idx)
    };
  });

  const reports: Report[] = Array.from({ length: dataset.reports }, (_, idx) => {
    const reporter = users[(idx + 5) % users.length];
    const post = posts[idx % posts.length];
    const status: Report["status"] =
      idx % 3 === 0 ? "open" : idx % 3 === 1 ? "triaged" : "resolved";
    return {
      id: `rpt_${idx + 1}`,
      postId: post!.id,
      reporterId: reporter!.id,
      reason: `baseline report reason ${idx + 1}`,
      status,
      createdAt: isoAt(baseMs, 1000 + idx)
    };
  });

  const appeals: Appeal[] = Array.from({ length: dataset.appeals }, (_, idx) => {
    const report = reports[idx % reports.length];
    const appellant = users[(idx + 9) % users.length];
    const status: Appeal["status"] = idx % 2 === 0 ? "open" : "under_review";
    return {
      id: `apl_${idx + 1}`,
      reportId: report!.id,
      appellantId: appellant!.id,
      reason: `baseline appeal reason ${idx + 1}`,
      status,
      createdAt: isoAt(baseMs, 1400 + idx),
      updatedAt: isoAt(baseMs, 1400 + idx)
    };
  });

  return {
    users,
    posts,
    reports,
    appeals
  };
}

function buildMutationSnapshots(initial: GovernedStore, iterations: number): GovernedStore[] {
  const snapshots: GovernedStore[] = [];
  let current = cloneStore(initial);

  for (let iteration = 1; iteration <= iterations; iteration += 1) {
    const next = cloneStore(current);

    const post = next.posts[iteration % next.posts.length];
    if (post) {
      post.body = `mutated-post-${iteration}-${post.id}`;
    }

    const report = next.reports[iteration % next.reports.length];
    if (report) {
      report.reason = `mutated-report-${iteration}-${report.id}`;
      const status: Report["status"] =
        iteration % 3 === 0 ? "resolved" : iteration % 2 === 0 ? "triaged" : "open";
      report.status = status;
    }

    if (iteration % 3 === 0) {
      const author = next.users[iteration % next.users.length];
      const createdAt = isoAt(Date.parse("2026-03-04T01:00:00.000Z"), iteration);
      const newPostId = `pst_extra_${iteration}`;
      next.posts.unshift({
        id: newPostId,
        authorId: author!.id,
        body: `extra-post-${iteration}`,
        createdAt
      });

      const reporter = next.users[(iteration + 2) % next.users.length];
      next.reports.unshift({
        id: `rpt_extra_${iteration}`,
        postId: newPostId,
        reporterId: reporter!.id,
        reason: `extra-report-${iteration}`,
        status: "open",
        createdAt
      });
    }

    if (iteration % 4 === 0 && next.reports.length > 40) {
      const removedReport = next.reports.pop();
      if (removedReport) {
        next.appeals = next.appeals.filter((appeal) => appeal.reportId !== removedReport.id);
      }
    }

    if (iteration % 5 === 0 && next.reports.length > 0) {
      const targetReport = next.reports[iteration % next.reports.length];
      const appellant = next.users[(iteration + 3) % next.users.length];
      const createdAt = isoAt(Date.parse("2026-03-04T02:00:00.000Z"), iteration);
      next.appeals.unshift({
        id: `apl_extra_${iteration}`,
        reportId: targetReport!.id,
        appellantId: appellant!.id,
        reason: `extra-appeal-${iteration}`,
        status: "open",
        createdAt,
        updatedAt: createdAt
      });
    }

    snapshots.push(next);
    current = next;
  }

  return snapshots;
}

function countRowDelta<T extends { id: string }>(before: T[], after: T[]): number {
  const beforeMap = new Map(before.map((entry) => [entry.id, JSON.stringify(entry)]));
  const afterMap = new Map(after.map((entry) => [entry.id, JSON.stringify(entry)]));

  let delta = 0;

  for (const [id, value] of afterMap) {
    if (!beforeMap.has(id) || beforeMap.get(id) !== value) {
      delta += 1;
    }
  }

  for (const id of beforeMap.keys()) {
    if (!afterMap.has(id)) {
      delta += 1;
    }
  }

  return delta;
}

function countChangedEntities(before: GovernedStore, after: GovernedStore): number {
  return (
    countRowDelta(before.users, after.users) +
    countRowDelta(before.posts, after.posts) +
    countRowDelta(before.reports, after.reports) +
    countRowDelta(before.appeals, after.appeals)
  );
}

async function runScenario(
  adapter: PostgresStorageAdapter,
  mode: ValidationMode,
  baseline: GovernedStore,
  snapshots: GovernedStore[],
  probe: QueryProbe
): Promise<IterationSample[]> {
  const samples: IterationSample[] = [];
  let previous = cloneStore(baseline);

  for (const [index, snapshot] of snapshots.entries()) {
    probe.reset();
    const startedAt = process.hrtime.bigint();

    if (mode === "incremental") {
      await adapter.flush(snapshot);
    } else {
      await adapter.reconcileFull(snapshot);
    }

    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const queryCounters = probe.snapshot();
    const changedEntities = countChangedEntities(previous, snapshot);

    samples.push({
      iteration: index + 1,
      durationMs,
      changedEntities,
      mutatingQueries: queryCounters.mutatingQueries,
      totalQueries: queryCounters.totalQueries
    });

    previous = cloneStore(snapshot);
  }

  return samples;
}

async function main() {
  const execute = hasFlag("--execute");
  const humanApprovalRef = parseArg("--human-approval-ref")?.trim();
  if (!execute) {
    throw new Error("validation requires --execute");
  }
  if (!humanApprovalRef) {
    throw new Error("validation requires --human-approval-ref=<change-ticket>");
  }

  const appRoot = process.cwd();
  const repoRoot = resolve(appRoot, "..", "..");
  const tmpDir = resolve(appRoot, parseArg("--tmp-dir") ?? DEFAULT_TMP_DIR);
  const markdownPath = resolve(repoRoot, parseArg("--markdown-output") ?? DEFAULT_MARKDOWN_PATH);
  const jsonPath = resolve(repoRoot, parseArg("--json-output") ?? DEFAULT_JSON_PATH);

  const dataset: DatasetConfig = {
    users: parseIntArg("--users", 40, 4, 500),
    posts: parseIntArg("--posts", 240, 40, 5000),
    reports: parseIntArg("--reports", 240, 40, 5000),
    appeals: parseIntArg("--appeals", 80, 10, 5000),
    iterations: parseIntArg("--iterations", 24, 5, 500)
  };

  const simulatedLatencyMs = parseIntArg("--simulated-latency-ms", 12, 0, 500);
  mkdirSync(tmpDir, { recursive: true });
  mkdirSync(dirname(markdownPath), { recursive: true });
  mkdirSync(dirname(jsonPath), { recursive: true });

  const postgresRuntime = await resolvePostgresRuntime(tmpDir);

  const policyEnv: Record<string, string | undefined> = {
    ...process.env,
    HUMANONLY_POSTGRES_URL: postgresRuntime.url,
    HUMANONLY_POSTGRES_APPLICATION_NAME:
      process.env.HUMANONLY_POSTGRES_APPLICATION_NAME ?? "humanonly-managed-incremental-validation",
    HUMANONLY_POSTGRES_POOL_SIZE: parseArg("--pool-size") ?? process.env.HUMANONLY_POSTGRES_POOL_SIZE,
    HUMANONLY_POSTGRES_IDLE_TIMEOUT_MS:
      parseArg("--idle-timeout-ms") ?? process.env.HUMANONLY_POSTGRES_IDLE_TIMEOUT_MS,
    HUMANONLY_POSTGRES_CONNECTION_TIMEOUT_MS:
      parseArg("--connection-timeout-ms") ?? process.env.HUMANONLY_POSTGRES_CONNECTION_TIMEOUT_MS,
    HUMANONLY_POSTGRES_STATEMENT_TIMEOUT_MS:
      parseArg("--statement-timeout-ms") ?? process.env.HUMANONLY_POSTGRES_STATEMENT_TIMEOUT_MS,
    HUMANONLY_POSTGRES_QUERY_TIMEOUT_MS:
      parseArg("--query-timeout-ms") ?? process.env.HUMANONLY_POSTGRES_QUERY_TIMEOUT_MS,
    HUMANONLY_POSTGRES_MAX_USES: parseArg("--max-uses") ?? process.env.HUMANONLY_POSTGRES_MAX_USES,
    HUMANONLY_POSTGRES_SSL_MODE: parseArg("--ssl-mode") ?? process.env.HUMANONLY_POSTGRES_SSL_MODE,
    HUMANONLY_POSTGRES_SSL_DISABLE_APPROVED:
      parseArg("--ssl-disable-approved") ?? process.env.HUMANONLY_POSTGRES_SSL_DISABLE_APPROVED
  };

  const poolPolicy = resolvePostgresPoolPolicy(policyEnv);
  const basePool = new Pool({
    connectionString: postgresRuntime.url,
    ...poolPolicy.config
  });
  const probe = new QueryProbe();
  const instrumentedPool = new InstrumentedPool(basePool, simulatedLatencyMs, probe);
  const adapter = new PostgresStorageAdapter(instrumentedPool as unknown as Pool, policyEnv);

  try {
    await adapter.initialize();

    const baseline = createBaselineStore(dataset);
    const snapshots = buildMutationSnapshots(baseline, dataset.iterations);

    await adapter.reconcileFull(baseline);
    const incrementalSamples = await runScenario(adapter, "incremental", baseline, snapshots, probe);

    await adapter.reconcileFull(baseline);
    const fullReconcileSamples = await runScenario(
      adapter,
      "full-reconcile",
      baseline,
      snapshots,
      probe
    );

    const report = withRedactedUrl({
      generatedAt: new Date().toISOString(),
      postgresSource: postgresRuntime.source,
      postgresUrl: postgresRuntime.url,
      humanApprovalRef,
      simulatedNetworkLatencyMs: simulatedLatencyMs,
      poolPolicy: {
        size: Number(poolPolicy.config.max ?? 0),
        idleTimeoutMs: Number(poolPolicy.config.idleTimeoutMillis ?? 0),
        connectionTimeoutMs: Number(poolPolicy.config.connectionTimeoutMillis ?? 0),
        statementTimeoutMs: Number(poolPolicy.config.statement_timeout ?? 0),
        queryTimeoutMs: Number(poolPolicy.config.query_timeout ?? 0),
        maxUses: Number(poolPolicy.config.maxUses ?? 0),
        sslMode: poolPolicy.effectiveSslMode,
        productionGuardrailApplied: poolPolicy.productionGuardrailApplied,
        rationale: poolPolicy.rationale
      },
      dataset,
      incremental: summarizeScenario("incremental", incrementalSamples),
      fullReconcile: summarizeScenario("full-reconcile", fullReconcileSamples)
    });

    const jsonReport = {
      ...report,
      governance: GOVERNANCE_ASSERTIONS,
      productionGuardrails: {
        ...GOVERNANCE_ASSERTIONS,
        writeActionExecuted: true
      },
      artifacts: {
        markdown: relative(repoRoot, markdownPath),
        json: relative(repoRoot, jsonPath)
      },
      rawSamples: {
        incremental: incrementalSamples,
        fullReconcile: fullReconcileSamples
      }
    };

    writeFileSync(jsonPath, `${JSON.stringify(jsonReport, null, 2)}\n`, "utf8");
    writeFileSync(markdownPath, `${renderIncrementalValidationMarkdown(report)}\n`, "utf8");

    console.log(`[perf:postgres-managed] wrote JSON report: ${jsonPath}`);
    console.log(`[perf:postgres-managed] wrote Markdown report: ${markdownPath}`);
  } finally {
    await adapter.close().catch(() => undefined);
    await postgresRuntime.cleanup().catch(() => undefined);
  }
}

if (process.argv.includes("--help")) {
  console.log(usage());
  process.exit(0);
}

main().catch((error) => {
  console.error("[perf:postgres-managed] failed", error instanceof Error ? error.message : error);
  console.error(usage());
  process.exit(1);
});
