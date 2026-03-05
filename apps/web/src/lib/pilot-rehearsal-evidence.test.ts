import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  evaluatePilotPreGoLiveGates,
  minutesBetween,
  renderPilotPreGoLiveMarkdown,
  type PilotPreGoLiveReport
} from "@/lib/pilot-rehearsal-evidence";

function makeReport(): PilotPreGoLiveReport {
  return {
    generatedAt: "2026-03-05T06:30:00.000Z",
    humanApprovalRef: "CHANGE-2026-03-05-PRE-GO-LIVE",
    rehearsalWindow: {
      startedAt: "2026-03-05T06:00:00.000Z",
      completedAt: "2026-03-05T06:30:00.000Z"
    },
    participants: {
      incidentCommander: "Chief Admin",
      platformOperator: "Platform Ops",
      governanceLead: "Governance Lead",
      moderationOperator: "Queue Moderator"
    },
    reliability: {
      generatedAt: "2026-03-05T06:30:00.000Z",
      healthy: true,
      auditChainValid: true,
      auditTotalRecords: 6,
      storageChecksHealthy: true,
      queueAlertsExceeded: 0,
      openReports: 1,
      openAppeals: 1
    },
    checklist: {
      immutableAuditWrites: true,
      dataSnapshotPersistenceSurvivesRestart: true,
      incidentRollbackPathDryRunTested: true,
      moderationQueueAndAppealsSmokeValidated: true,
      adminOverrideRestrictedTestedAuditable: true
    },
    drills: [
      {
        drillId: "drill-sev1",
        scenario: "sev1",
        description: "Sev1 acknowledgement drill",
        firstAlertAt: "2026-03-05T06:00:00.000Z",
        firstAcknowledgedAt: "2026-03-05T06:06:00.000Z",
        escalatedAt: "2026-03-05T06:08:00.000Z",
        ackSlaTargetMinutes: 10,
        ackLatencyMinutes: 6,
        passed: true,
        evidenceRefs: ["packet:inc_1"]
      },
      {
        drillId: "drill-sev2",
        scenario: "sev2",
        description: "Sev2 acknowledgement drill",
        firstAlertAt: "2026-03-05T06:15:00.000Z",
        firstAcknowledgedAt: "2026-03-05T06:34:00.000Z",
        escalatedAt: null,
        ackSlaTargetMinutes: 30,
        ackLatencyMinutes: 19,
        passed: true,
        evidenceRefs: ["packet:inc_2"]
      }
    ],
    governance: {
      humanExpressionOnly: true,
      aiManagedOperationsOnly: true,
      humanGovernedDecisionsOnly: true,
      auditabilityRequired: true,
      humanOverrideReservedForAdmins: true
    },
    risks: [],
    nextActions: ["Attach report to release ticket"]
  };
}

describe("pilot pre-go-live rehearsal evidence", () => {
  it("computes minute deltas and guards invalid timestamps", () => {
    assert.equal(minutesBetween("2026-03-05T06:00:00.000Z", "2026-03-05T06:07:30.000Z"), 7.5);
    assert.equal(minutesBetween("2026-03-05T06:10:00.000Z", "2026-03-05T06:07:00.000Z"), null);
    assert.equal(minutesBetween("invalid", "2026-03-05T06:07:00.000Z"), null);
  });

  it("fails acknowledgement gate when any drill misses sla", () => {
    const report = makeReport();
    report.drills[0]!.passed = false;
    report.drills[0]!.ackLatencyMinutes = 12;

    const gates = evaluatePilotPreGoLiveGates(report);
    const sloGate = gates.find((gate) => gate.gate === "Acknowledgement SLO drills");
    assert.equal(sloGate?.status, "fail");
  });

  it("renders markdown with gate and drill tables", () => {
    const markdown = renderPilotPreGoLiveMarkdown(makeReport());

    assert.match(markdown, /# Sprint 7 Pre-Go-Live Rehearsal Report/);
    assert.match(markdown, /\| Acknowledgement SLO drills \| PASS \|/);
    assert.match(markdown, /\| drill-sev1 \| SEV1 \| 6.0 \| 10 \| Yes \| PASS \|/);
    assert.match(markdown, /Admin override restricted\/tested\/auditable: PASS/);
  });
});
