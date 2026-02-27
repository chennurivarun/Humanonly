import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { writeAuditStub, resetAuditStateForTests } from "@/lib/audit";
import {
  configureIncidentStoreForTests,
  declareIncident,
  resolveIncident,
  resetIncidentsForTests
} from "@/lib/incident";
import { buildIncidentPacket } from "@/lib/incident/packet";

const NOW = "2026-02-27T12:00:00.000Z";

let tempDir = "";

beforeEach(() => {
  tempDir = mkdtempSync(path.join(tmpdir(), "humanonly-incident-packet-"));
  configureIncidentStoreForTests(path.join(tempDir, "incidents.json"));
  process.env.HUMANONLY_AUDIT_LOG_FILE = path.join(tempDir, "audit.jsonl");
  resetIncidentsForTests();
  resetAuditStateForTests();
});

afterEach(() => {
  delete process.env.HUMANONLY_AUDIT_LOG_FILE;
  resetIncidentsForTests();
  resetAuditStateForTests();

  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
    tempDir = "";
  }
});

describe("buildIncidentPacket", () => {
  it("returns null when incident id is unknown", () => {
    const packet = buildIncidentPacket("inc_missing", NOW);
    assert.equal(packet, null);
  });

  it("exports timeline + audit references + governance rationale", async () => {
    const declared = declareIncident({
      severity: "sev1",
      title: "Audit hash mismatch",
      description: "Hash-chain verification failed during active moderation window.",
      declaredById: "usr_admin",
      humanConfirmed: true,
      nowIso: "2026-02-27T12:00:00.000Z"
    });

    assert.equal(declared.ok, true);
    if (!declared.ok) return;

    await writeAuditStub({
      actorId: "usr_admin",
      action: "admin.incident.declared",
      targetType: "incident",
      targetId: declared.incident.id,
      metadata: {
        severity: declared.incident.severity,
        humanConfirmed: true
      },
      createdAt: "2026-02-27T12:00:01.000Z"
    });

    const resolved = resolveIncident({
      incidentId: declared.incident.id,
      resolvedById: "usr_admin",
      resolutionNotes: "Paused moderation writes, verified chain continuity, and resumed safely.",
      humanConfirmed: true,
      nowIso: "2026-02-27T12:30:00.000Z"
    });

    assert.equal(resolved.ok, true);
    if (!resolved.ok) return;

    await writeAuditStub({
      actorId: "usr_admin",
      action: "admin.incident.resolved",
      targetType: "incident",
      targetId: declared.incident.id,
      metadata: {
        humanConfirmed: true,
        resolutionNotes: resolved.incident.resolutionNotes
      },
      createdAt: "2026-02-27T12:30:01.000Z"
    });

    const packet = buildIncidentPacket(declared.incident.id, NOW);

    assert.ok(packet, "packet should be generated for existing incident");
    if (!packet) return;

    assert.equal(packet.packetVersion, 1);
    assert.equal(packet.generatedAt, NOW);
    assert.equal(packet.incident.id, declared.incident.id);
    assert.equal(packet.incident.status, "resolved");

    assert.equal(packet.auditReferences.length, 2);
    assert.equal(packet.auditReferences[0]?.action, "admin.incident.declared");
    assert.equal(packet.auditReferences[1]?.action, "admin.incident.resolved");

    assert.ok(packet.timeline.some((event) => event.eventType === "incident_declared"));
    assert.ok(packet.timeline.some((event) => event.eventType === "incident_resolved"));
    assert.ok(packet.timeline.some((event) => event.eventType === "audit_recorded"));

    assert.equal(packet.governanceRationale.assertions.humanExpressionOnly, true);
    assert.equal(packet.governanceRationale.assertions.humanGovernedDecisionsOnly, true);
    assert.equal(packet.governanceRationale.pendingDecision, null);
    assert.ok(packet.governanceRationale.resolutionSummary?.includes("verified chain continuity"));
  });
});
