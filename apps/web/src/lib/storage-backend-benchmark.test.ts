import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  percentDelta,
  redactPostgresUrl,
  renderStorageBackendBenchmarkReport,
  toCompareRows,
  type HarnessSummary
} from "@/lib/storage-backend-benchmark";

describe("storage-backend-benchmark", () => {
  it("builds compare rows for matching sqlite/postgres harness results", () => {
    const sqlite: HarnessSummary = {
      generatedAt: "2026-03-03T00:00:00.000Z",
      auditMode: "sync",
      results: [
        {
          tier: "baseline",
          endpoint: "POST /api/posts",
          averageLatencyMs: 10,
          p95LatencyMs: 14,
          throughputRps: 90,
          failure: 0,
          auditFailure: 0
        }
      ]
    };

    const postgres: HarnessSummary = {
      generatedAt: "2026-03-03T00:00:01.000Z",
      auditMode: "sync",
      results: [
        {
          tier: "baseline",
          endpoint: "POST /api/posts",
          averageLatencyMs: 8,
          p95LatencyMs: 12,
          throughputRps: 105,
          failure: 0,
          auditFailure: 0
        }
      ]
    };

    const rows = toCompareRows(sqlite, postgres);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.avgDeltaPct, -20);
    assert.equal(rows[0]?.p95DeltaPct, -14.285714285714285);
    assert.equal(rows[0]?.throughputDeltaPct, 16.666666666666664);
  });

  it("redacts password from postgres URL", () => {
    const redacted = redactPostgresUrl("postgres://human:secret@localhost:5432/humanonly");
    assert.equal(redacted, "postgres://human:***@localhost:5432/humanonly");
  });

  it("renders markdown report with governance controls and artifacts", () => {
    const markdown = renderStorageBackendBenchmarkReport({
      generatedAt: "2026-03-03T00:00:00.000Z",
      auditMode: "sync",
      postgresSource: "embedded",
      postgresUrl: "postgres://human:secret@localhost:5432/humanonly",
      sqliteJsonPath: ".tmp/sqlite.json",
      postgresJsonPath: ".tmp/postgres.json",
      rows: [
        {
          tier: "baseline",
          endpoint: "POST /api/posts",
          sqliteAvgMs: 10,
          postgresAvgMs: 8,
          avgDeltaPct: percentDelta(10, 8),
          sqliteP95Ms: 14,
          postgresP95Ms: 12,
          p95DeltaPct: percentDelta(14, 12),
          sqliteThroughput: 90,
          postgresThroughput: 105,
          throughputDeltaPct: percentDelta(90, 105)
        }
      ]
    });

    assert.match(markdown, /Governance controls \(enforced\)/);
    assert.match(markdown, /PostgreSQL source: `embedded`/);
    assert.match(markdown, /postgres:\/\/human:\*\*\*@localhost:5432\/humanonly/);
    assert.match(markdown, /SQLite JSON: `\.tmp\/sqlite\.json`/);
  });
});
