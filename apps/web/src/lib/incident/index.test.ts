import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  declareIncident,
  resolveIncident,
  getIncidents,
  resetIncidentsForTests
} from "./index";

// ── Setup ─────────────────────────────────────────────────────────────────────

const NOW = "2026-02-27T12:00:00.000Z";

describe("declareIncident", () => {
  beforeEach(() => {
    resetIncidentsForTests();
  });

  it("declares a valid incident and returns it", () => {
    const result = declareIncident({
      severity: "sev2",
      title: "Audit write failure",
      description: "Audit log writes are timing out on the primary instance.",
      declaredById: "usr_admin",
      humanConfirmed: true,
      nowIso: NOW
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.equal(result.incident.severity, "sev2");
    assert.equal(result.incident.title, "Audit write failure");
    assert.equal(result.incident.status, "open");
    assert.equal(result.incident.humanConfirmed, true);
    assert.equal(result.incident.declaredById, "usr_admin");
    assert.equal(result.incident.declaredAt, NOW);
    assert.equal(result.incident.resolvedAt, null);
    assert.ok(result.incident.id.startsWith("inc_"));
  });

  it("adds the declared incident to the in-memory list", () => {
    declareIncident({
      severity: "sev3",
      title: "Minor queue delay",
      description: "Queue processing is 10 minutes delayed.",
      declaredById: "usr_admin",
      humanConfirmed: true,
      nowIso: NOW
    });

    assert.equal(getIncidents().length, 1);
  });

  it("rejects when humanConfirmed is false", () => {
    const result = declareIncident({
      severity: "sev1",
      title: "Critical audit failure",
      description: "Hash chain is broken.",
      declaredById: "usr_admin",
      humanConfirmed: false,
      nowIso: NOW
    });

    assert.equal(result.ok, false);
    if (result.ok) return;

    const err = result.errors.find((e) => e.field === "humanConfirmed");
    assert.ok(err, "expected humanConfirmed error");
  });

  it("rejects invalid severity", () => {
    const result = declareIncident({
      severity: "sev99" as never,
      title: "Bad severity",
      description: "Testing bad severity value.",
      declaredById: "usr_admin",
      humanConfirmed: true,
      nowIso: NOW
    });

    assert.equal(result.ok, false);
    if (result.ok) return;

    const err = result.errors.find((e) => e.field === "severity");
    assert.ok(err);
  });

  it("rejects empty title", () => {
    const result = declareIncident({
      severity: "sev2",
      title: "   ",
      description: "Valid description.",
      declaredById: "usr_admin",
      humanConfirmed: true,
      nowIso: NOW
    });

    assert.equal(result.ok, false);
    if (result.ok) return;

    const err = result.errors.find((e) => e.field === "title");
    assert.ok(err);
  });

  it("rejects title exceeding max length", () => {
    const result = declareIncident({
      severity: "sev3",
      title: "x".repeat(201),
      description: "Valid description.",
      declaredById: "usr_admin",
      humanConfirmed: true,
      nowIso: NOW
    });

    assert.equal(result.ok, false);
    if (result.ok) return;

    const err = result.errors.find((e) => e.field === "title");
    assert.ok(err);
  });

  it("stores incidents in reverse chronological order (newest first)", () => {
    declareIncident({
      severity: "sev3",
      title: "First incident",
      description: "First.",
      declaredById: "usr_admin",
      humanConfirmed: true,
      nowIso: "2026-02-27T10:00:00.000Z"
    });

    declareIncident({
      severity: "sev2",
      title: "Second incident",
      description: "Second.",
      declaredById: "usr_admin",
      humanConfirmed: true,
      nowIso: "2026-02-27T11:00:00.000Z"
    });

    const list = getIncidents();
    assert.equal(list[0]?.title, "Second incident");
    assert.equal(list[1]?.title, "First incident");
  });
});

// ── resolveIncident ───────────────────────────────────────────────────────────

describe("resolveIncident", () => {
  beforeEach(() => {
    resetIncidentsForTests();
  });

  it("resolves an open incident with human confirmation", () => {
    const declared = declareIncident({
      severity: "sev2",
      title: "Queue delay",
      description: "Delayed queue processing.",
      declaredById: "usr_admin",
      humanConfirmed: true,
      nowIso: NOW
    });

    assert.equal(declared.ok, true);
    if (!declared.ok) return;

    const resolved = resolveIncident({
      incidentId: declared.incident.id,
      resolvedById: "usr_admin",
      resolutionNotes: "Restarted the processing service; queue drained within 5 minutes.",
      humanConfirmed: true,
      nowIso: "2026-02-27T14:00:00.000Z"
    });

    assert.equal(resolved.ok, true);
    if (!resolved.ok) return;

    assert.equal(resolved.incident.status, "resolved");
    assert.equal(resolved.incident.resolvedAt, "2026-02-27T14:00:00.000Z");
    assert.equal(resolved.incident.resolvedById, "usr_admin");
    assert.ok(resolved.incident.resolutionNotes?.includes("Restarted"));
  });

  it("rejects resolving a non-existent incident", () => {
    const result = resolveIncident({
      incidentId: "inc_nonexistent",
      resolvedById: "usr_admin",
      resolutionNotes: "Resolved.",
      humanConfirmed: true,
      nowIso: NOW
    });

    assert.equal(result.ok, false);
    if (result.ok) return;

    const err = result.errors.find((e) => e.field === "incidentId");
    assert.ok(err);
  });

  it("rejects resolving an already-resolved incident", () => {
    const declared = declareIncident({
      severity: "sev3",
      title: "Minor issue",
      description: "Minor.",
      declaredById: "usr_admin",
      humanConfirmed: true,
      nowIso: NOW
    });

    assert.equal(declared.ok, true);
    if (!declared.ok) return;

    resolveIncident({
      incidentId: declared.incident.id,
      resolvedById: "usr_admin",
      resolutionNotes: "Resolved.",
      humanConfirmed: true,
      nowIso: NOW
    });

    const second = resolveIncident({
      incidentId: declared.incident.id,
      resolvedById: "usr_admin",
      resolutionNotes: "Trying again.",
      humanConfirmed: true,
      nowIso: NOW
    });

    assert.equal(second.ok, false);
    if (second.ok) return;

    const err = second.errors.find((e) => e.field === "incidentId");
    assert.ok(err);
    assert.match(err.reason, /already resolved/);
  });

  it("rejects when humanConfirmed is false", () => {
    const declared = declareIncident({
      severity: "sev2",
      title: "Queue failure",
      description: "Serious queue issue.",
      declaredById: "usr_admin",
      humanConfirmed: true,
      nowIso: NOW
    });

    assert.equal(declared.ok, true);
    if (!declared.ok) return;

    const result = resolveIncident({
      incidentId: declared.incident.id,
      resolvedById: "usr_admin",
      resolutionNotes: "Fixed.",
      humanConfirmed: false,
      nowIso: NOW
    });

    assert.equal(result.ok, false);
    if (result.ok) return;

    const err = result.errors.find((e) => e.field === "humanConfirmed");
    assert.ok(err);
  });

  it("rejects empty resolution notes", () => {
    const declared = declareIncident({
      severity: "sev3",
      title: "Minor lag",
      description: "Minor.",
      declaredById: "usr_admin",
      humanConfirmed: true,
      nowIso: NOW
    });

    assert.equal(declared.ok, true);
    if (!declared.ok) return;

    const result = resolveIncident({
      incidentId: declared.incident.id,
      resolvedById: "usr_admin",
      resolutionNotes: "   ",
      humanConfirmed: true,
      nowIso: NOW
    });

    assert.equal(result.ok, false);
    if (result.ok) return;

    const err = result.errors.find((e) => e.field === "resolutionNotes");
    assert.ok(err);
  });
});
