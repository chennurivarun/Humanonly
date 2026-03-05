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

export type SignOffStatus = "pending" | "approved" | "rejected";

export type ReleaseOwnerSignOff = {
  owner?: string;
  status?: SignOffStatus;
  approvalRef?: string;
  signedAt?: string;
  notes?: string;
};

export type ReleaseEvidenceSignOffs = {
  releaseManager?: ReleaseOwnerSignOff;
  incidentCommander?: ReleaseOwnerSignOff;
  platformOperator?: ReleaseOwnerSignOff;
  governanceLead?: ReleaseOwnerSignOff;
};

export type ManagedEndpointSource =
  | "workflow-input"
  | "repo-secret"
  | "env"
  | "ephemeral-default"
  | "unknown"
  | (string & {});

export type ManagedEndpointClassification =
  | "external"
  | "loopback"
  | "private-network"
  | "invalid"
  | "unknown";

export type ManagedEndpointEvidence = {
  url?: string;
  redactedUrl?: string;
  source?: ManagedEndpointSource;
};

export type ManagedEndpointAssessment = {
  source: ManagedEndpointSource;
  classification: ManagedEndpointClassification;
  host: string;
  redactedUrl?: string;
  details: string;
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
  signOffs?: ReleaseEvidenceSignOffs;
  managedEndpoint?: ManagedEndpointEvidence;
  risks: string[];
  nextActions: string[];
};

export type CadenceGate = {
  gate: string;
  status: "pass" | "fail";
  details: string;
};

export type GoLiveReadinessGate = {
  gate: string;
  status: "pass" | "fail";
  details: string;
};

const ROLE_LABELS = {
  releaseManager: "Release Manager",
  incidentCommander: "Incident Commander",
  platformOperator: "Platform Operator",
  governanceLead: "Governance Lead"
} as const;

type RoleKey = keyof typeof ROLE_LABELS;

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

function parseIpv4(host: string): number[] | undefined {
  const segments = host.split(".");
  if (segments.length !== 4) return undefined;

  const octets = segments.map((segment) => Number.parseInt(segment, 10));
  if (octets.some((octet, idx) => !Number.isFinite(octet) || octet < 0 || octet > 255 || String(octet) !== segments[idx])) {
    return undefined;
  }

  return octets;
}

function isLoopbackIpv4(octets: number[]): boolean {
  return octets[0] === 127;
}

function isPrivateIpv4(octets: number[]): boolean {
  if (octets[0] === 10) return true;
  if (octets[0] === 192 && octets[1] === 168) return true;
  if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true;
  if (octets[0] === 169 && octets[1] === 254) return true;
  return false;
}

function classifyHostname(hostname: string): ManagedEndpointClassification {
  const host = hostname.trim().toLowerCase();
  if (!host) return "unknown";

  if (host === "localhost" || host === "::1") {
    return "loopback";
  }

  if (host.endsWith(".local") || host.endsWith(".internal")) {
    return "private-network";
  }

  const octets = parseIpv4(host);
  if (octets) {
    if (isLoopbackIpv4(octets)) return "loopback";
    if (isPrivateIpv4(octets)) return "private-network";
    return "external";
  }

  if (host.includes(":")) {
    const normalized = host.replace(/\[|\]/g, "");
    if (normalized === "::1") return "loopback";
    if (normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:")) {
      return "private-network";
    }
  }

  return "external";
}

export function redactManagedEndpointUrl(connectionUrl: string): string {
  try {
    const parsed = new URL(connectionUrl);
    if (parsed.username) parsed.username = "***";
    if (parsed.password) parsed.password = "***";

    ["password", "pass", "pwd"].forEach((key) => {
      if (parsed.searchParams.has(key)) {
        parsed.searchParams.set(key, "***");
      }
    });

    return parsed.toString();
  } catch {
    return "[invalid-url]";
  }
}

export function classifyManagedPostgresEndpoint(
  endpoint: ManagedEndpointEvidence | undefined
): ManagedEndpointAssessment {
  const candidateUrl = endpoint?.url ?? endpoint?.redactedUrl;
  if (!candidateUrl) {
    return {
      source: endpoint?.source ?? "unknown",
      classification: "unknown",
      host: "unknown",
      details: "managed endpoint URL not provided"
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(candidateUrl);
  } catch {
    return {
      source: endpoint?.source ?? "unknown",
      classification: "invalid",
      host: "invalid",
      redactedUrl: "[invalid-url]",
      details: "managed endpoint URL is not a valid URL"
    };
  }

  const classification = classifyHostname(parsed.hostname);

  return {
    source: endpoint?.source ?? "unknown",
    classification,
    host: parsed.hostname,
    redactedUrl: endpoint?.redactedUrl ?? redactManagedEndpointUrl(candidateUrl),
    details:
      classification === "external"
        ? "endpoint host resolves to non-loopback/non-private network"
        : classification === "loopback"
          ? "endpoint points to localhost/loopback; rotate to externally managed host"
          : classification === "private-network"
            ? "endpoint points to private/internal network; confirm final external production endpoint"
            : "endpoint classification unavailable"
  };
}

function normalizeSignOff(
  ownerName: string | undefined,
  rawSignOff: ReleaseOwnerSignOff | undefined
): Required<ReleaseOwnerSignOff> {
  return {
    owner: owner(rawSignOff?.owner ?? ownerName),
    status: rawSignOff?.status ?? "pending",
    approvalRef: rawSignOff?.approvalRef ?? "—",
    signedAt: rawSignOff?.signedAt ?? "—",
    notes: rawSignOff?.notes ?? "—"
  };
}

function resolveSignOffMatrix(bundle: ReleaseGovernanceEvidenceBundle): Record<RoleKey, Required<ReleaseOwnerSignOff>> {
  return {
    releaseManager: normalizeSignOff(bundle.owners.releaseManager, bundle.signOffs?.releaseManager),
    incidentCommander: normalizeSignOff(bundle.owners.incidentCommander, bundle.signOffs?.incidentCommander),
    platformOperator: normalizeSignOff(bundle.owners.platformOperator, bundle.signOffs?.platformOperator),
    governanceLead: normalizeSignOff(bundle.owners.governanceLead, bundle.signOffs?.governanceLead)
  };
}

function signOffStatusLabel(status: SignOffStatus): string {
  if (status === "approved") return "APPROVED";
  if (status === "rejected") return "REJECTED";
  return "PENDING";
}

function signOffIsApproved(signOff: Required<ReleaseOwnerSignOff>): boolean {
  if (signOff.status !== "approved") return false;
  if (!signOff.owner || signOff.owner === "TBD") return false;
  if (!signOff.approvalRef || signOff.approvalRef === "—") return false;
  if (!signOff.signedAt || signOff.signedAt === "—") return false;
  return true;
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

export function evaluateGoLiveReadiness(bundle: ReleaseGovernanceEvidenceBundle): GoLiveReadinessGate[] {
  const cadencePass = evaluateCadenceGates(bundle).every((gate) => gate.status === "pass");
  const endpoint = classifyManagedPostgresEndpoint(bundle.managedEndpoint);
  const signOffs = resolveSignOffMatrix(bundle);

  const approvedRoles = (Object.keys(signOffs) as RoleKey[]).filter((role) => signOffIsApproved(signOffs[role]));
  const allSignOffsApproved = approvedRoles.length === 4;

  const pendingOrRejected = (Object.keys(signOffs) as RoleKey[])
    .filter((role) => !signOffIsApproved(signOffs[role]))
    .map((role) => `${ROLE_LABELS[role]}=${signOffStatusLabel(signOffs[role].status)}`)
    .join(", ");

  return [
    {
      gate: "Cadence governance gates",
      status: gateStatus(cadencePass),
      details: cadencePass ? "all cadence gates PASS" : "one or more cadence gates are FAIL"
    },
    {
      gate: "Managed Postgres endpoint rotated to external target",
      status: gateStatus(endpoint.classification === "external"),
      details: `source=${endpoint.source}, host=${endpoint.host}, classification=${endpoint.classification}`
    },
    {
      gate: "Explicit human owner sign-offs",
      status: gateStatus(allSignOffsApproved),
      details: allSignOffsApproved
        ? "all required owner sign-offs recorded with approval references"
        : `awaiting sign-offs: ${pendingOrRejected || "none"}`
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
  const goLiveGates = evaluateGoLiveReadiness(bundle);
  const signOffs = resolveSignOffMatrix(bundle);
  const endpoint = classifyManagedPostgresEndpoint(bundle.managedEndpoint);

  const gateRows = gates
    .map(
      (gate) =>
        `| ${gate.gate} | ${gate.status === "pass" ? "PASS" : "FAIL"} | ${gate.details.replaceAll("|", "\\|")} |`
    )
    .join("\n");

  const goLiveRows = goLiveGates
    .map(
      (gate) =>
        `| ${gate.gate} | ${gate.status === "pass" ? "PASS" : "FAIL"} | ${gate.details.replaceAll("|", "\\|")} |`
    )
    .join("\n");

  const signOffRows = (Object.keys(ROLE_LABELS) as RoleKey[])
    .map((role) => {
      const signOff = signOffs[role];
      return `| ${ROLE_LABELS[role]} | ${signOff.owner} | ${signOffStatusLabel(signOff.status)} | ${signOff.approvalRef} | ${signOff.signedAt} | ${signOff.notes.replaceAll("|", "\\|")} |`;
    })
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

## Managed endpoint governance
- Endpoint source: \`${endpoint.source}\`
- Endpoint classification: \`${endpoint.classification}\`
- Endpoint host: \`${endpoint.host}\`
- Endpoint URL (redacted): ${endpoint.redactedUrl ?? "not provided"}
- Assessment: ${endpoint.details}

## Managed-profile validation deltas
- Avg latency delta (incremental vs full reconcile): ${latencyDelta.toFixed(1)}%
- p95 latency delta (incremental vs full reconcile): ${p95Delta.toFixed(1)}%
- Avg mutating SQL delta (incremental vs full reconcile): ${queryDelta.toFixed(1)}%
- Simulated network latency per SQL round trip: ${bundle.managedValidation.simulatedNetworkLatencyMs}ms
- Validation PostgreSQL source: \`${bundle.managedValidation.postgresSource}\`

## Required evidence artifacts
${bundle.artifacts.map(renderArtifactLine).join("\n")}

## Ownership + sign-off
| Role | Owner | Decision | Approval Ref | Timestamp | Notes |
|---|---|---|---|---|---|
${signOffRows}

## Go-live readiness gates
| Gate | Status | Details |
|---|---|---|
${goLiveRows}

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
