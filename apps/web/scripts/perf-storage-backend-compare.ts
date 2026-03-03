import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

type HarnessResult = {
  tier: string;
  endpoint: string;
  averageLatencyMs: number;
  p95LatencyMs: number;
  throughputRps: number;
  failure: number;
  auditFailure: number;
};

type HarnessSummary = {
  generatedAt: string;
  auditMode: "sync" | "async";
  results: HarnessResult[];
};

type Backend = "sqlite" | "postgres";

type CompareRow = {
  tier: string;
  endpoint: string;
  sqliteAvgMs: number;
  postgresAvgMs: number;
  avgDeltaPct: number;
  sqliteP95Ms: number;
  postgresP95Ms: number;
  p95DeltaPct: number;
  sqliteThroughput: number;
  postgresThroughput: number;
  throughputDeltaPct: number;
};

const DEFAULT_TMP_DIR = ".tmp/perf-backend-compare";

function parseArg(flag: string): string | undefined {
  const idx = process.argv.findIndex((token) => token === flag || token.startsWith(`${flag}=`));
  if (idx === -1) return undefined;
  const token = process.argv[idx];
  if (token.includes("=")) return token.split("=").slice(1).join("=");
  const next = process.argv[idx + 1];
  return next && !next.startsWith("--") ? next : undefined;
}

function ensurePostgresUrl(): string {
  const value = process.env.HUMANONLY_POSTGRES_URL?.trim();
  if (!value) {
    throw new Error(
      "HUMANONLY_POSTGRES_URL is required to run backend comparison. Set it, then rerun npm run perf:storage-backend."
    );
  }
  return value;
}

function runHarness(backend: Backend, jsonOutput: string) {
  const env = { ...process.env };
  const auditPath = resolve(`${DEFAULT_TMP_DIR}/${backend}/audit-log.jsonl`);

  env.HUMANONLY_AUDIT_WRITE_MODE = "sync";
  env.HUMANONLY_AUDIT_LOG_FILE = auditPath;

  if (backend === "sqlite") {
    env.HUMANONLY_STORAGE_BACKEND = "sqlite";
    env.HUMANONLY_DB_FILE = resolve(`${DEFAULT_TMP_DIR}/sqlite/store.db`);
  } else {
    env.HUMANONLY_STORAGE_BACKEND = "postgres";
    env.HUMANONLY_POSTGRES_URL = ensurePostgresUrl();
    delete env.HUMANONLY_DB_FILE;
  }

  const result = spawnSync(
    "npm",
    ["run", "perf:harness", "--", "--audit-mode=sync", `--json-output=${jsonOutput}`, "--silent"],
    {
      cwd: resolve("apps/web"),
      env,
      stdio: "inherit"
    }
  );

  if (result.status !== 0) {
    throw new Error(`Performance harness failed for ${backend} (exit=${result.status ?? "unknown"})`);
  }
}

function percentDelta(from: number, to: number): number {
  if (from === 0) return to === 0 ? 0 : 100;
  return ((to - from) / from) * 100;
}

function toRows(sqlite: HarnessSummary, postgres: HarnessSummary): CompareRow[] {
  const postgresMap = new Map<string, HarnessResult>(
    postgres.results.map((row) => [`${row.tier}__${row.endpoint}`, row])
  );

  return sqlite.results.map((sqliteRow) => {
    const key = `${sqliteRow.tier}__${sqliteRow.endpoint}`;
    const pgRow = postgresMap.get(key);
    if (!pgRow) {
      throw new Error(`Missing postgres row for ${key}`);
    }

    return {
      tier: sqliteRow.tier,
      endpoint: sqliteRow.endpoint,
      sqliteAvgMs: sqliteRow.averageLatencyMs,
      postgresAvgMs: pgRow.averageLatencyMs,
      avgDeltaPct: percentDelta(sqliteRow.averageLatencyMs, pgRow.averageLatencyMs),
      sqliteP95Ms: sqliteRow.p95LatencyMs,
      postgresP95Ms: pgRow.p95LatencyMs,
      p95DeltaPct: percentDelta(sqliteRow.p95LatencyMs, pgRow.p95LatencyMs),
      sqliteThroughput: sqliteRow.throughputRps,
      postgresThroughput: pgRow.throughputRps,
      throughputDeltaPct: percentDelta(sqliteRow.throughputRps, pgRow.throughputRps)
    };
  });
}

function markdownTable(rows: CompareRow[]): string {
  const header =
    "| Tier | Endpoint | SQLite avg (ms) | Postgres avg (ms) | Avg Δ % | SQLite p95 (ms) | Postgres p95 (ms) | p95 Δ % | SQLite throughput (req/s) | Postgres throughput (req/s) | Throughput Δ % |";
  const separator = "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|";

  const lines = rows.map((row) => {
    return `| ${row.tier} | ${row.endpoint} | ${row.sqliteAvgMs.toFixed(2)} | ${row.postgresAvgMs.toFixed(2)} | ${row.avgDeltaPct.toFixed(1)}% | ${row.sqliteP95Ms.toFixed(2)} | ${row.postgresP95Ms.toFixed(2)} | ${row.p95DeltaPct.toFixed(1)}% | ${row.sqliteThroughput.toFixed(1)} | ${row.postgresThroughput.toFixed(1)} | ${row.throughputDeltaPct.toFixed(1)}% |`;
  });

  return [header, separator, ...lines].join("\n");
}

function main() {
  const tmpDir = resolve(parseArg("--tmp-dir") ?? DEFAULT_TMP_DIR);
  const sqliteJson = resolve(parseArg("--sqlite-json") ?? `${tmpDir}/sqlite.json`);
  const postgresJson = resolve(parseArg("--postgres-json") ?? `${tmpDir}/postgres.json`);
  const markdownOutput = resolve(
    parseArg("--markdown-output") ?? "docs/SPRINT_6_STORAGE_BACKEND_BENCHMARK.md"
  );

  mkdirSync(dirname(sqliteJson), { recursive: true });
  mkdirSync(dirname(postgresJson), { recursive: true });
  mkdirSync(dirname(markdownOutput), { recursive: true });

  runHarness("sqlite", sqliteJson);
  runHarness("postgres", postgresJson);

  const sqliteSummary = JSON.parse(readFileSync(sqliteJson, "utf8")) as HarnessSummary;
  const postgresSummary = JSON.parse(readFileSync(postgresJson, "utf8")) as HarnessSummary;

  const rows = toRows(sqliteSummary, postgresSummary);
  const report = `# Sprint 6 Storage Backend Benchmark\n\nGenerated: ${new Date().toISOString()}\nAudit mode: sync\n\n## SQLite vs Postgres (same harness profile)\n\n${markdownTable(rows)}\n\n## Artifacts\n- SQLite JSON: \`${sqliteJson}\`\n- Postgres JSON: \`${postgresJson}\`\n`;

  writeFileSync(markdownOutput, `${report}\n`, "utf8");
  console.log(`Wrote backend benchmark report to ${markdownOutput}`);
}

main();
