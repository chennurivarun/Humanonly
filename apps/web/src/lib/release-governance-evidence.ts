export type CadenceAction = "plan" | "apply" | "verify";

export type CutoverEvidenceReport = {
  generatedAt: string;
  action: CadenceAction;
  humanApprovalRef?: string;
  parity?: {
    countsMatch: boolean;
    fingerprintMatch: boolean;
  };
  productionGuardrails: {
    humanExpressionOnly: boolean;
    aiManagedOperationsOnly: boolean;
    humanGovernedDecisionsOnly: boolean;
    auditabilityRequired: boolean;
    humanOverrideReservedForAdmins: boolean;
    writeActionExecuted: boolean;
  };
};

export type ManagedValidationEvidenceReport = {
  generatedAt: string;
  humanApprovalRef: string;
  simulatedNetworkLatencyMs: number;
  postgresSource: "cli" | "env" | "embedded";
  incremental: {
    averageDurationMs: number;
    p95DurationMs: number;
    averageMutatingQueries: number;
  };
  fullReconcile: {
    averageDurationMs: number;
    p95DurationMs: number;
    averageMutatingQueries: number;
  };
};

export type ReleaseEvidenceArtifact = {
  label: string;
  path: string;
  url?: string;
};

export type ReleaseEvidenceOwners = {
  releaseManager?: string;
  incidentCommander?: string;
  platformOperator?: string;
  governanceLead?: string;
};

export type ReleaseGovernanceEvidenceBundle = {
  generatedAt: string;
  approvalRef: string;
  cadenceRun: {
    runId: string;
    runUrl: string;
    targetProfile: "managed" | "ephemeral" | "unknown";
    executedAt?: string;
  };
  cutover: {
    plan: CutoverEvidenceReport;
    apply: CutoverEvidenceReport;
    verify: CutoverEvidenceReport;
  };
  managedValidation: ManagedValidationEvidenceReport;
  artifacts: ReleaseEvidenceArtifact[];
  owners: ReleaseEvidenceOwners;
  risks: string[];
  nextActions: string[];
};

export type CadenceGate = {
  gate: string;
  status: "pass" | "fail";
  details: string;
};

function percentDelta(from: number, to: number): number {
  if (from === 0) return to === 0 ? 0 : 100;
  return ((to - from) / from) * 100;
}

function owner(value: string | undefined): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "TBD";
}

function gateStatus(ok: boolean): "pass" | "fail" {
  return ok ? "pass" : "fail";
}

export function evaluateCadenceGates(bundle: ReleaseGovernanceEvidenceBundle): CadenceGate[] {
  const plan = bundle.cutover.plan;
  const apply = bundle.cutover.apply;
  const verify = bundle.cutover.verify;

  const applyParityOk = Boolean(apply.parity?.countsMatch && apply.parity.fingerprintMatch);
  const verifyParityOk = Boolean(verify.parity?.countsMatch && verify.parity.fingerprintMatch);

  const latencyDelta = percentDelta(
    bundle.managedValidation.fullReconcile.averageDurationMs,
    bundle.managedValidation.incremental.averageDurationMs
  );
  const queryDelta = percentDelta(
    bundle.managedValidation.fullReconcile.averageMutatingQueries,
    bundle.managedValidation.incremental.averageMutatingQueries
  );
  const managedValidationOk = latencyDelta < 0 && queryDelta < 0;

  return [
    {
      gate: "Governed cutover plan generated",
      status: gateStatus(plan.action === "plan"),
      details: `action=${plan.action}, generatedAt=${plan.generatedAt}`
    },
    {
      gate: "Governed cutover apply executed with human approval",
      status: gateStatus(Boolean(apply.productionGuardrails.writeActionExecuted && apply.humanApprovalRef)),
      details: apply.humanApprovalRef
        ? `approvalRef=${apply.humanApprovalRef}`
        : "missing humanApprovalRef or write action execution"
    },
    {
      gate: "Cutover parity verification",
      status: gateStatus(applyParityOk && verifyParityOk),
      details: `apply(counts=${apply.parity?.countsMatch ? "ok" : "fail"}, fingerprint=${
        apply.parity?.fingerprintMatch ? "ok" : "fail"
      }); verify(counts=${verify.parity?.countsMatch ? "ok" : "fail"}, fingerprint=${
        verify.parity?.fingerprintMatch ? "ok" : "fail"
      })`
    },
    {
      gate: "Managed-profile incremental validation",
      status: gateStatus(managedValidationOk),
      details: `avgLatencyDelta=${latencyDelta.toFixed(1)}%, mutatingQueryDelta=${queryDelta.toFixed(1)}%`
    }
  ];
}

function renderArtifactLine(artifact: ReleaseEvidenceArtifact): string {
  if (artifact.url) {
    return `- ${artifact.label}: [${artifact.path}](${artifact.url})`;
  }

  return `- ${artifact.label}: ${artifact.path}`;
}

export function renderReleaseGovernanceEvidenceMarkdown(
  bundle: ReleaseGovernanceEvidenceBundle
): string {
  const gates = evaluateCadenceGates(bundle);
  const gateRows = gates
    .map(
      (gate) =>
        `| ${gate.gate} | ${gate.status === "pass" ? "PASS" : "FAIL"} | ${gate.details.replaceAll("|", "\\|")} |`
    )
    .join("\n");

  const latencyDelta = percentDelta(
    bundle.managedValidation.fullReconcile.averageDurationMs,
    bundle.managedValidation.incremental.averageDurationMs
  );
  const p95Delta = percentDelta(
    bundle.managedValidation.fullReconcile.p95DurationMs,
    bundle.managedValidation.incremental.p95DurationMs
  );
  const queryDelta = percentDelta(
    bundle.managedValidation.fullReconcile.averageMutatingQueries,
    bundle.managedValidation.incremental.averageMutatingQueries
  );

  const risks = bundle.risks.length > 0 ? bundle.risks.map((risk) => `- ${risk}`).join("\n") : "- None";
  const nextActions =
    bundle.nextActions.length > 0
      ? bundle.nextActions.map((action, idx) => `${idx + 1}. ${action}`).join("\n")
      : "1. None";

  return `# Sprint 7 Release Governance Evidence Bundle

Generated: ${bundle.generatedAt}

## Cadence run metadata
- Run ID: \`${bundle.cadenceRun.runId}\`
- Run URL: ${bundle.cadenceRun.runUrl}
- Target profile: \`${bundle.cadenceRun.targetProfile}\`
- Executed at: \`${bundle.cadenceRun.executedAt ?? bundle.generatedAt}\`
- Human approval reference: \`${bundle.approvalRef}\`

## Governance gate outcomes
| Gate | Status | Details |
|---|---|---|
${gateRows}

## Managed-profile validation deltas
- Avg latency delta (incremental vs full reconcile): ${latencyDelta.toFixed(1)}%
- p95 latency delta (incremental vs full reconcile): ${p95Delta.toFixed(1)}%
- Avg mutating SQL delta (incremental vs full reconcile): ${queryDelta.toFixed(1)}%
- Simulated network latency per SQL round trip: ${bundle.managedValidation.simulatedNetworkLatencyMs}ms
- Validation PostgreSQL source: \`${bundle.managedValidation.postgresSource}\`

## Required evidence artifacts
${bundle.artifacts.map(renderArtifactLine).join("\n")}

## Ownership + sign-off
| Role | Owner | Sign-off |
|---|---|---|
| Release Manager | ${owner(bundle.owners.releaseManager)} | ☐ |
| Incident Commander | ${owner(bundle.owners.incidentCommander)} | ☐ |
| Platform Operator | ${owner(bundle.owners.platformOperator)} | ☐ |
| Governance Lead | ${owner(bundle.owners.governanceLead)} | ☐ |

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
