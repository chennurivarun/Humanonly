import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
  buildQueueLatencyMetrics,
  buildReliabilityStatus,
  checkAuditChainIntegrity,
  checkStorageFile,
  RELIABILITY_THRESHOLDS
} from "./index";
import type { Appeal, IdentityProfile, Report } from "@/lib/store";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeReport(overrides: Partial<Report> = {}): Report {
  return {
    id: "rpt_default",
    postId: "pst_1",
    reporterId: "usr_1",
    reason: "Test report",
    status: "open",
    createdAt: new Date().toISOString(),
    ...overrides
  };
}

function makeAppeal(overrides: Partial<Appeal> = {}): Appeal {
  return {
    id: "app_default",
    reportId: "rpt_1",
    appellantId: "usr_1",
    reason: "Test appeal",
    status: "open",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  };
}

const EMPTY_STORE = {
  users: [] as IdentityProfile[],
  reports: [] as Report[],
  appeals: [] as Appeal[]
};

// ── Storage health checks ─────────────────────────────────────────────────────

describe("checkStorageFile", () => {
  it("reports healthy for an existing file", () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), "humanonly-rel-"));
    const filePath = path.join(tempDir, "store.json");
    writeFileSync(filePath, '{"version":1}', "utf8");

    const result = checkStorageFile("Test store", filePath);

    assert.equal(result.label, "Test store");
    assert.equal(result.filePath, filePath);
    assert.equal(result.exists, true);
    assert.equal(result.healthy, true);
    assert.ok(typeof result.sizeBytes === "number" && result.sizeBytes > 0);
    assert.ok(typeof result.lastModifiedAt === "string");
  });

  it("reports unhealthy for a missing file", () => {
    const result = checkStorageFile("Missing", "/nonexistent/path/store.json");

    assert.equal(result.exists, false);
    assert.equal(result.healthy, false);
    assert.equal(result.sizeBytes, null);
    assert.equal(result.lastModifiedAt, null);
  });
});

// ── Audit chain integrity ─────────────────────────────────────────────────────

describe("checkAuditChainIntegrity", () => {
  it("reports valid chain with zero records when audit log is absent", async () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), "humanonly-rel-chain-"));
    process.env.HUMANONLY_AUDIT_LOG_FILE = path.join(tempDir, "absent-audit.jsonl");

    const { resetAuditStateForTests } = await import("@/lib/audit");
    resetAuditStateForTests();

    const result = checkAuditChainIntegrity();

    assert.equal(result.totalRecords, 0);
    assert.equal(result.lastSequence, null);
    assert.equal(result.chainValid, true);
    assert.equal(result.chainError, null);
  });

  it("reports valid chain and correct sequence after writes", async () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), "humanonly-rel-chain2-"));
    process.env.HUMANONLY_AUDIT_LOG_FILE = path.join(tempDir, "audit.jsonl");

    const { resetAuditStateForTests, writeAuditStub } = await import("@/lib/audit");
    resetAuditStateForTests();

    await writeAuditStub({
      actorId: "usr_admin",
      action: "admin.reliability.requested",
      targetType: "reliability",
      createdAt: new Date().toISOString()
    });

    await writeAuditStub({
      actorId: "usr_admin",
      action: "admin.reliability.requested",
      targetType: "reliability",
      createdAt: new Date().toISOString()
    });

    const result = checkAuditChainIntegrity();

    assert.equal(result.totalRecords, 2);
    assert.equal(result.lastSequence, 2);
    assert.equal(result.chainValid, true);
    assert.equal(result.chainError, null);
  });
});

// ── Queue latency metrics ─────────────────────────────────────────────────────

describe("buildQueueLatencyMetrics", () => {
  const NOW = "2026-02-27T12:00:00.000Z";

  it("returns zeroes with no open reports or appeals", () => {
    const result = buildQueueLatencyMetrics(EMPTY_STORE, NOW);

    assert.equal(result.openReports, 0);
    assert.equal(result.openAppeals, 0);
    assert.equal(result.oldestOpenReportAgeHours, null);
    assert.equal(result.oldestOpenAppealAgeHours, null);
    assert.ok(result.alerts.every((alert) => !alert.exceeded));
  });

  it("computes oldest report age in hours", () => {
    const twoHoursAgo = new Date(Date.parse(NOW) - 2 * 60 * 60 * 1000).toISOString();
    const store = {
      ...EMPTY_STORE,
      reports: [makeReport({ status: "open", createdAt: twoHoursAgo })]
    };

    const result = buildQueueLatencyMetrics(store, NOW);

    assert.equal(result.openReports, 1);
    assert.equal(result.oldestOpenReportAgeHours, 2.0);
  });

  it("excludes resolved reports from open count", () => {
    const store = {
      ...EMPTY_STORE,
      reports: [
        makeReport({ id: "rpt_open", status: "open" }),
        makeReport({ id: "rpt_resolved", status: "resolved" })
      ]
    };

    const result = buildQueueLatencyMetrics(store, NOW);

    assert.equal(result.openReports, 1);
  });

  it("includes under_review appeals in open appeals count", () => {
    const store = {
      ...EMPTY_STORE,
      appeals: [
        makeAppeal({ id: "app_open", status: "open" }),
        makeAppeal({ id: "app_review", status: "under_review" }),
        makeAppeal({ id: "app_upheld", status: "upheld" })
      ]
    };

    const result = buildQueueLatencyMetrics(store, NOW);

    assert.equal(result.openAppeals, 2);
  });

  it("triggers alert when open reports exceed threshold", () => {
    const reports = Array.from({ length: 21 }, (_, i) =>
      makeReport({ id: `rpt_${i}`, status: "open" })
    );
    const store = { ...EMPTY_STORE, reports };
    const thresholds = { ...RELIABILITY_THRESHOLDS, openReportsCountAlert: 20 };

    const result = buildQueueLatencyMetrics(store, NOW, thresholds);

    const openCountAlert = result.alerts.find((a) => a.metric === "openReportsCount");
    assert.ok(openCountAlert);
    assert.equal(openCountAlert.exceeded, true);
    assert.equal(openCountAlert.value, 21);
    assert.equal(openCountAlert.threshold, 20);
  });

  it("triggers alert when oldest open report exceeds age threshold", () => {
    const seventyHoursAgo = new Date(Date.parse(NOW) - 70 * 60 * 60 * 1000).toISOString();
    const store = {
      ...EMPTY_STORE,
      reports: [makeReport({ status: "open", createdAt: seventyHoursAgo })]
    };
    const thresholds = { ...RELIABILITY_THRESHOLDS, oldestOpenReportAgeHoursAlert: 48 };

    const result = buildQueueLatencyMetrics(store, NOW, thresholds);

    const ageAlert = result.alerts.find((a) => a.metric === "oldestOpenReportAgeHours");
    assert.ok(ageAlert);
    assert.equal(ageAlert.exceeded, true);
  });

  it("does not trigger age alert when all reports are recent", () => {
    const oneHourAgo = new Date(Date.parse(NOW) - 1 * 60 * 60 * 1000).toISOString();
    const store = {
      ...EMPTY_STORE,
      reports: [makeReport({ status: "open", createdAt: oneHourAgo })]
    };

    const result = buildQueueLatencyMetrics(store, NOW);

    const ageAlert = result.alerts.find((a) => a.metric === "oldestOpenReportAgeHours");
    assert.ok(ageAlert);
    assert.equal(ageAlert.exceeded, false);
  });
});

// ── buildReliabilityStatus ────────────────────────────────────────────────────

describe("buildReliabilityStatus", () => {
  it("returns healthy=false when storage files are absent", async () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), "humanonly-rel-full-"));
    process.env.HUMANONLY_AUDIT_LOG_FILE = path.join(tempDir, "absent-audit.jsonl");
    process.env.HUMANONLY_DATA_FILE = path.join(tempDir, "absent-store.json");

    const { resetAuditStateForTests } = await import("@/lib/audit");
    resetAuditStateForTests();

    const result = buildReliabilityStatus(EMPTY_STORE, {
      nowIso: "2026-02-27T12:00:00.000Z"
    });

    assert.equal(typeof result.generatedAt, "string");
    assert.ok(result.governance.humanExpressionOnly);
    assert.ok(result.governance.auditabilityRequired);
    assert.equal(result.healthy, false);
    assert.ok(Array.isArray(result.storage));
    assert.ok(result.storage.every((s) => s.exists === false));
    assert.equal(result.auditChain.totalRecords, 0);
    assert.equal(result.auditChain.chainValid, true);
  });

  it("includes governance assertions in every response", () => {
    const result = buildReliabilityStatus(EMPTY_STORE);

    assert.equal(result.governance.humanExpressionOnly, true);
    assert.equal(result.governance.aiManagedOperationsOnly, true);
    assert.equal(result.governance.humanGovernedDecisionsOnly, true);
    assert.equal(result.governance.auditabilityRequired, true);
    assert.equal(result.governance.humanOverrideReservedForAdmins, true);
  });
});
