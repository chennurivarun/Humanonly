export type HarnessResult = {
  tier: string;
  endpoint: string;
  averageLatencyMs: number;
  p95LatencyMs: number;
  throughputRps: number;
  failure: number;
  auditFailure: number;
};

export type HarnessSummary = {
  generatedAt: string;
  auditMode: "sync" | "async";
  results: HarnessResult[];
};

export type CompareRow = {
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

export type PostgresSource = "cli" | "env" | "embedded";

export type StorageBackendBenchmarkReportOptions = {
  generatedAt: string;
  auditMode: "sync";
  rows: CompareRow[];
  sqliteJsonPath: string;
  postgresJsonPath: string;
  postgresSource: PostgresSource;
  postgresUrl: string;
};

export function percentDelta(from: number, to: number): number {
  if (from === 0) return to === 0 ? 0 : 100;
  return ((to - from) / from) * 100;
}

export function toCompareRows(sqlite: HarnessSummary, postgres: HarnessSummary): CompareRow[] {
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

export function redactPostgresUrl(connectionString: string): string {
  try {
    const parsed = new URL(connectionString);
    if (parsed.password) {
      parsed.password = "***";
    }
    return parsed.toString();
  } catch {
    return "<invalid-url>";
  }
}

export function markdownTable(rows: CompareRow[]): string {
  const header =
    "| Tier | Endpoint | SQLite avg (ms) | Postgres avg (ms) | Avg Δ % | SQLite p95 (ms) | Postgres p95 (ms) | p95 Δ % | SQLite throughput (req/s) | Postgres throughput (req/s) | Throughput Δ % |";
  const separator = "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|";

  const lines = rows.map((row) => {
    return `| ${row.tier} | ${row.endpoint} | ${row.sqliteAvgMs.toFixed(2)} | ${row.postgresAvgMs.toFixed(2)} | ${row.avgDeltaPct.toFixed(1)}% | ${row.sqliteP95Ms.toFixed(2)} | ${row.postgresP95Ms.toFixed(2)} | ${row.p95DeltaPct.toFixed(1)}% | ${row.sqliteThroughput.toFixed(1)} | ${row.postgresThroughput.toFixed(1)} | ${row.throughputDeltaPct.toFixed(1)}% |`;
  });

  return [header, separator, ...lines].join("\n");
}

export function renderStorageBackendBenchmarkReport(
  options: StorageBackendBenchmarkReportOptions
): string {
  const redactedUrl = redactPostgresUrl(options.postgresUrl);

  return `# Sprint 6 Storage Backend Benchmark

Generated: ${options.generatedAt}
Audit mode: ${options.auditMode}

## Goal
Compare SQLite and PostgreSQL using the same perf harness profile for governed writes/reads:
- \`POST /api/posts\`
- \`GET /api/feed\`
- \`POST /api/reports\`

## Execution details
- PostgreSQL source: \`${options.postgresSource}\`
- PostgreSQL URL (redacted): \`${redactedUrl}\`
- Audit mode: \`${options.auditMode}\` (durability-preserving baseline)

## SQLite vs Postgres (same harness profile)

${markdownTable(options.rows)}

## Governance controls (enforced)
- Human expression only: benchmark traffic uses deterministic synthetic fixtures only.
- AI-managed operations: benchmark orchestration + report generation are automated and reproducible.
- Human-governed decisions: production audit-mode changes remain explicit human approvals.
- Auditability: source artifacts are retained and referenced below.
- Human override: operators can force \`HUMANONLY_AUDIT_WRITE_MODE=sync\` immediately.

## Artifacts
- SQLite JSON: \`${options.sqliteJsonPath}\`
- Postgres JSON: \`${options.postgresJsonPath}\`
`;
}
