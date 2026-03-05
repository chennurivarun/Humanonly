import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  percentDelta,
  renderIncrementalValidationMarkdown,
  summarizeScenario,
  withRedactedUrl,
  type IterationSample
} from "@/lib/postgres-incremental-benchmark";

describe("postgres-incremental-benchmark", () => {
  it("summarizes scenario latency + query metrics", () => {
    const samples: IterationSample[] = [
      {
        iteration: 1,
        durationMs: 10,
        changedEntities: 4,
        mutatingQueries: 12,
        totalQueries: 15
      },
      {
        iteration: 2,
        durationMs: 20,
        changedEntities: 5,
        mutatingQueries: 13,
        totalQueries: 16
      }
    ];

    const summary = summarizeScenario("incremental", samples);

    assert.equal(summary.mode, "incremental");
    assert.equal(summary.iterations, 2);
    assert.equal(summary.averageDurationMs, 15);
    assert.equal(summary.p95DurationMs, 20);
    assert.equal(summary.maxDurationMs, 20);
    assert.equal(summary.averageChangedEntities, 4.5);
    assert.equal(summary.averageMutatingQueries, 12.5);
    assert.equal(summary.averageTotalQueries, 15.5);
  });

  it("redacts postgres password and renders governance sections", () => {
    const report = withRedactedUrl({
      generatedAt: "2026-03-04T00:00:00.000Z",
      postgresSource: "env",
      postgresUrl: "postgres://human:secret@db.example.com:5432/humanonly",
      humanApprovalRef: "CHANGE-2026-03-04",
      simulatedNetworkLatencyMs: 12,
      poolPolicy: {
        size: 20,
        idleTimeoutMs: 10000,
        connectionTimeoutMs: 5000,
        statementTimeoutMs: 5000,
        queryTimeoutMs: 5000,
        maxUses: 0,
        sslMode: "require",
        productionGuardrailApplied: false,
        rationale: "pool defaults resolved"
      },
      dataset: {
        users: 20,
        posts: 120,
        reports: 120,
        appeals: 40,
        iterations: 10
      },
      incremental: {
        mode: "incremental",
        iterations: 10,
        averageDurationMs: 40,
        p95DurationMs: 55,
        maxDurationMs: 61,
        averageChangedEntities: 5,
        averageMutatingQueries: 18,
        averageTotalQueries: 21
      },
      fullReconcile: {
        mode: "full-reconcile",
        iterations: 10,
        averageDurationMs: 120,
        p95DurationMs: 142,
        maxDurationMs: 150,
        averageChangedEntities: 5,
        averageMutatingQueries: 400,
        averageTotalQueries: 403
      }
    });

    const markdown = renderIncrementalValidationMarkdown(report);

    assert.equal(Object.hasOwn(report, "postgresUrl"), false);
    assert.match(markdown, /postgres:\/\/human:\*\*\*@db\.example\.com:5432\/humanonly/);
    assert.match(markdown, /Human approval reference: `CHANGE-2026-03-04`/);
    assert.match(markdown, /Governance controls \(enforced\)/);
  });

  it("computes percent deltas", () => {
    assert.equal(percentDelta(100, 80), -20);
    assert.equal(percentDelta(100, 120), 20);
    assert.equal(percentDelta(0, 0), 0);
  });
});
