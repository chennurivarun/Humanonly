export type ValidationMode = "incremental" | "full-reconcile";

export type IterationSample = {
  iteration: number;
  durationMs: number;
  changedEntities: number;
  mutatingQueries: number;
  totalQueries: number;
};

export type ScenarioSummary = {
  mode: ValidationMode;
  iterations: number;
  averageDurationMs: number;
  p95DurationMs: number;
  maxDurationMs: number;
  averageChangedEntities: number;
  averageMutatingQueries: number;
  averageTotalQueries: number;
};

export type IncrementalValidationReport = {
  generatedAt: string;
  postgresSource: "cli" | "env" | "embedded";
  postgresUrlRedacted: string;
  humanApprovalRef: string;
  simulatedNetworkLatencyMs: number;
  poolPolicy: {
    size: number;
    idleTimeoutMs: number;
    connectionTimeoutMs: number;
    statementTimeoutMs: number;
    queryTimeoutMs: number;
    maxUses: number;
    sslMode: string;
    productionGuardrailApplied: boolean;
    rationale: string;
  };
  dataset: {
    users: number;
    posts: number;
    reports: number;
    appeals: number;
    iterations: number;
  };
  incremental: ScenarioSummary;
  fullReconcile: ScenarioSummary;
};

export function percentDelta(from: number, to: number): number {
  if (from === 0) return to === 0 ? 0 : 100;
  return ((to - from) / from) * 100;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[rank] ?? 0;
}

export function summarizeScenario(mode: ValidationMode, samples: IterationSample[]): ScenarioSummary {
  const durations = samples.map((sample) => sample.durationMs);
  const changed = samples.map((sample) => sample.changedEntities);
  const mutatingQueries = samples.map((sample) => sample.mutatingQueries);
  const totalQueries = samples.map((sample) => sample.totalQueries);

  return {
    mode,
    iterations: samples.length,
    averageDurationMs: average(durations),
    p95DurationMs: percentile(durations, 95),
    maxDurationMs: durations.length > 0 ? Math.max(...durations) : 0,
    averageChangedEntities: average(changed),
    averageMutatingQueries: average(mutatingQueries),
    averageTotalQueries: average(totalQueries)
  };
}

function modeLabel(mode: ValidationMode): string {
  return mode === "incremental" ? "Incremental flush" : "Forced full reconcile";
}

function redactedUrl(connectionString: string): string {
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

export function renderIncrementalValidationMarkdown(report: IncrementalValidationReport): string {
  const incrementalLatencyDelta = percentDelta(
    report.fullReconcile.averageDurationMs,
    report.incremental.averageDurationMs
  );
  const incrementalP95Delta = percentDelta(
    report.fullReconcile.p95DurationMs,
    report.incremental.p95DurationMs
  );
  const mutatingQueryDelta = percentDelta(
    report.fullReconcile.averageMutatingQueries,
    report.incremental.averageMutatingQueries
  );

  const rows = [report.incremental, report.fullReconcile]
    .map(
      (summary) =>
        `| ${modeLabel(summary.mode)} | ${summary.iterations} | ${summary.averageDurationMs.toFixed(2)} | ${summary.p95DurationMs.toFixed(2)} | ${summary.maxDurationMs.toFixed(2)} | ${summary.averageChangedEntities.toFixed(1)} | ${summary.averageMutatingQueries.toFixed(1)} | ${summary.averageTotalQueries.toFixed(1)} |`
    )
    .join("\n");

  return `# Sprint 6 Managed Postgres Incremental Persistence Validation

Generated: ${report.generatedAt}

## Goal
Validate that PostgreSQL incremental persistence remains effective under managed-production-like pool policy and network latency conditions.

## Execution details
- PostgreSQL source: \`${report.postgresSource}\`
- PostgreSQL URL (redacted): \`${report.postgresUrlRedacted}\`
- Human approval reference: \`${report.humanApprovalRef}\`
- Simulated network latency: \`${report.simulatedNetworkLatencyMs}ms\` per SQL round-trip

### Pool policy (resolved)
- Pool size: \`${report.poolPolicy.size}\`
- Idle timeout: \`${report.poolPolicy.idleTimeoutMs}ms\`
- Connection timeout: \`${report.poolPolicy.connectionTimeoutMs}ms\`
- Statement timeout: \`${report.poolPolicy.statementTimeoutMs}ms\`
- Query timeout: \`${report.poolPolicy.queryTimeoutMs}ms\`
- Max uses: \`${report.poolPolicy.maxUses}\`
- SSL mode (effective): \`${report.poolPolicy.sslMode}\`
- Production guardrail applied: \`${report.poolPolicy.productionGuardrailApplied ? "yes" : "no"}\`
- Guardrail rationale: ${report.poolPolicy.rationale}

### Dataset profile
- Users: ${report.dataset.users}
- Posts: ${report.dataset.posts}
- Reports: ${report.dataset.reports}
- Appeals: ${report.dataset.appeals}
- Iterations: ${report.dataset.iterations}

## Incremental vs full reconcile

| Mode | Iterations | Avg latency (ms) | p95 latency (ms) | Max latency (ms) | Avg changed entities | Avg mutating SQL queries | Avg total SQL queries |
|---|---:|---:|---:|---:|---:|---:|---:|
${rows}

## Key deltas (incremental relative to forced full reconcile)
- Avg latency delta: ${incrementalLatencyDelta.toFixed(1)}%
- p95 latency delta: ${incrementalP95Delta.toFixed(1)}%
- Mutating SQL query delta: ${mutatingQueryDelta.toFixed(1)}%

## Governance controls (enforced)
- Human expression only: synthetic deterministic payloads only.
- AI-managed operations: benchmark orchestration/report generation automated.
- Human-governed decisions: execution requires explicit \`--execute\` + \`--human-approval-ref\`.
- Auditability: JSON + Markdown artifacts generated per run.
- Human override: operators can stop validation and keep SQLite as active backend.
`;
}

export function withRedactedUrl(report: Omit<IncrementalValidationReport, "postgresUrlRedacted"> & { postgresUrl: string }): IncrementalValidationReport {
  return {
    ...report,
    postgresUrlRedacted: redactedUrl(report.postgresUrl)
  };
}
