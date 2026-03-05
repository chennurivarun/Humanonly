import { GOVERNANCE_ASSERTIONS } from "@/lib/governed-store";

export type RehearsalScenario = "sev1" | "sev2" | "failover";

export type RehearsalDrill = {
  drillId: string;
  scenario: RehearsalScenario;
  description: string;
  firstAlertAt: string;
  firstAcknowledgedAt: string;
  escalatedAt: string | null;
  ackSlaTargetMinutes: number;
  ackLatencyMinutes: number | null;
  passed: boolean;
  evidenceRefs: string[];
};

export type PilotReliabilitySnapshot = {
  generatedAt: string;
  healthy: boolean;
  auditChainValid: boolean;
  auditTotalRecords: number;
  storageChecksHealthy: boolean;
  queueAlertsExceeded: number;
  openReports: number;
  openAppeals: number;
};

export type PilotRunbookChecklist = {
  immutableAuditWrites: boolean;
  dataSnapshotPersistenceSurvivesRestart: boolean;
  incidentRollbackPathDryRunTested: boolean;
  moderationQueueAndAppealsSmokeValidated: boolean;
  adminOverrideRestrictedTestedAuditable: boolean;
};

export type PilotPreGoLiveReport = {
  generatedAt: string;
  humanApprovalRef: string;
  rehearsalWindow: {
    startedAt: string;
    completedAt: string;
  };
  participants: {
    incidentCommander: string;
    platformOperator: string;
    governanceLead: string;
    moderationOperator: string;
  };
  reliability: PilotReliabilitySnapshot;
  checklist: PilotRunbookChecklist;
  drills: RehearsalDrill[];
  governance: typeof GOVERNANCE_ASSERTIONS;
  risks: string[];
  nextActions: string[];
};

export type PilotGate = {
  gate: string;
  status: "pass" | "fail";
  details: string;
};

function round(value: number, digits = 1): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

export function minutesBetween(startIso: string, endIso: string): number | null {
  const start = Date.parse(startIso);
  const end = Date.parse(endIso);

  if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
    return null;
  }

  return round((end - start) / (1000 * 60), 1);
}

export function evaluateDrillPass(drill: Omit<RehearsalDrill, "passed">): boolean {
  if (drill.ackLatencyMinutes === null) {
    return false;
  }

  if (drill.ackLatencyMinutes > drill.ackSlaTargetMinutes) {
    return false;
  }

  return drill.evidenceRefs.length > 0;
}

export function evaluatePilotPreGoLiveGates(report: PilotPreGoLiveReport): PilotGate[] {
  const checklistItems = Object.entries(report.checklist);
  const checklistFailures = checklistItems.filter(([, value]) => value !== true);
  const failedDrills = report.drills.filter((drill) => !drill.passed);

  return [
    {
      gate: "Reliability status healthy",
      status: report.reliability.healthy ? "pass" : "fail",
      details: report.reliability.healthy
        ? `auditRecords=${report.reliability.auditTotalRecords}, queueAlerts=${report.reliability.queueAlertsExceeded}`
        : "one or more reliability checks failed"
    },
    {
      gate: "Sprint 3 reliability controls checklist",
      status: checklistFailures.length === 0 ? "pass" : "fail",
      details:
        checklistFailures.length === 0
          ? "all pilot gate checklist controls satisfied"
          : checklistFailures.map(([key]) => key).join(", ")
    },
    {
      gate: "Acknowledgement SLO drills",
      status: failedDrills.length === 0 ? "pass" : "fail",
      details:
        failedDrills.length === 0
          ? report.drills
              .map((drill) => `${drill.scenario}: ${drill.ackLatencyMinutes?.toFixed(1) ?? "n/a"}m`) 
              .join("; ")
          : failedDrills.map((drill) => drill.drillId).join(", ")
    },
    {
      gate: "Governance assertions held",
      status: Object.values(report.governance).every((value) => value === true) ? "pass" : "fail",
      details: "human expression only; AI-managed operations; human-governed decisions; auditability; admin override"
    }
  ];
}

function renderDrillRow(drill: RehearsalDrill): string {
  return `| ${drill.drillId} | ${drill.scenario.toUpperCase()} | ${drill.ackLatencyMinutes?.toFixed(1) ?? "n/a"} | ${drill.ackSlaTargetMinutes} | ${drill.escalatedAt ? "Yes" : "No"} | ${drill.passed ? "PASS" : "FAIL"} |`;
}

export function renderPilotPreGoLiveMarkdown(report: PilotPreGoLiveReport): string {
  const gates = evaluatePilotPreGoLiveGates(report);
  const gateRows = gates
    .map((gate) => `| ${gate.gate} | ${gate.status === "pass" ? "PASS" : "FAIL"} | ${gate.details.replaceAll("|", "\\|")} |`)
    .join("\n");

  const drillRows = report.drills.map(renderDrillRow).join("\n");
  const risks = report.risks.length > 0 ? report.risks.map((risk) => `- ${risk}`).join("\n") : "- None";
  const nextActions =
    report.nextActions.length > 0
      ? report.nextActions.map((action, idx) => `${idx + 1}. ${action}`).join("\n")
      : "1. None";

  return `# Sprint 7 Pre-Go-Live Rehearsal Report

Generated: ${report.generatedAt}

## Rehearsal metadata
- Human approval reference: \`${report.humanApprovalRef}\`
- Window start: \`${report.rehearsalWindow.startedAt}\`
- Window end: \`${report.rehearsalWindow.completedAt}\`
- Incident Commander: ${report.participants.incidentCommander}
- Platform Operator: ${report.participants.platformOperator}
- Governance Lead: ${report.participants.governanceLead}
- Moderation Operator: ${report.participants.moderationOperator}

## Governance gate outcomes
| Gate | Status | Details |
|---|---|---|
${gateRows}

## Incident / escalation timing evidence
| Drill | Scenario | Ack latency (min) | SLO target (min) | Escalated | Result |
|---|---|---:|---:|---|---|
${drillRows}

## Reliability snapshot
- Healthy: ${report.reliability.healthy ? "yes" : "no"}
- Audit chain valid: ${report.reliability.auditChainValid ? "yes" : "no"} (${report.reliability.auditTotalRecords} records)
- Storage checks healthy: ${report.reliability.storageChecksHealthy ? "yes" : "no"}
- Queue alerts exceeded: ${report.reliability.queueAlertsExceeded}
- Open reports: ${report.reliability.openReports}
- Open appeals: ${report.reliability.openAppeals}

## Sprint 3 pilot reliability controls checklist
- Immutable audit writes succeed: ${report.checklist.immutableAuditWrites ? "PASS" : "FAIL"}
- Data snapshot persistence survives restart/reload: ${report.checklist.dataSnapshotPersistenceSurvivesRestart ? "PASS" : "FAIL"}
- Incident rollback path dry-run tested: ${report.checklist.incidentRollbackPathDryRunTested ? "PASS" : "FAIL"}
- Moderation queue + appeals smoke validated: ${report.checklist.moderationQueueAndAppealsSmokeValidated ? "PASS" : "FAIL"}
- Admin override restricted/tested/auditable: ${report.checklist.adminOverrideRestrictedTestedAuditable ? "PASS" : "FAIL"}

## Governance assertions
- Human expression only
- AI-managed operations
- Human-governed decisions
- Auditability required
- Human override reserved for admins

## Risks
${risks}

## Next actions
${nextActions}
`;
}
