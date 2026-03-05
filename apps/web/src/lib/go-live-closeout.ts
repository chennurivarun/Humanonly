import { GOVERNANCE_ASSERTIONS } from "@/lib/governed-store";
import {
  evaluateGoLiveReadiness,
  type GoLiveReadinessGate,
  type ReleaseGovernanceEvidenceBundle,
  type SignOffStatus
} from "@/lib/release-governance-evidence";

const ROLE_LABELS = {
  releaseManager: "Release Manager",
  incidentCommander: "Incident Commander",
  platformOperator: "Platform Operator",
  governanceLead: "Governance Lead"
} as const;

type RoleKey = keyof typeof ROLE_LABELS;

export type GoLiveDecisionStatus = "approved" | "rejected" | "deferred";

export type GoLiveDecision = {
  status: GoLiveDecisionStatus;
  approvalRef: string;
  decidedBy: string;
  decidedAt: string;
  notes?: string;
};

export type GoLiveSignOffState = {
  role: RoleKey;
  roleLabel: string;
  owner: string;
  status: SignOffStatus;
  approvalRef: string;
  signedAt: string;
  notes: string;
  approved: boolean;
};

export type SignOffRequestDraft = {
  role: RoleKey;
  roleLabel: string;
  owner: string;
  contact?: string;
  status: SignOffStatus;
  subject: string;
  message: string;
};

export type GoLiveCloseoutReport = {
  generatedAt: string;
  sourceEvidenceGeneratedAt: string;
  cadenceRunId: string;
  cadenceRunUrl: string;
  readinessGates: GoLiveReadinessGate[];
  signOffStates: GoLiveSignOffState[];
  pendingSignOffRequests: SignOffRequestDraft[];
  blockingItems: string[];
  recommendation: "blocked" | "ready-for-human-decision";
  finalOutcome:
    | "blocked"
    | "awaiting-human-decision"
    | "go-live-approved"
    | "go-live-rejected"
    | "go-live-deferred";
  decision?: GoLiveDecision;
  governance: typeof GOVERNANCE_ASSERTIONS;
  nextActions: string[];
};

export type GoLiveCloseoutOptions = {
  generatedAt?: string;
  decision?: GoLiveDecision;
  signOffContacts?: Partial<Record<RoleKey, string>>;
};

function owner(raw?: string): string {
  const value = raw?.trim();
  return value && value.length > 0 ? value : "TBD";
}

function normalizeSignOffStatus(raw?: SignOffStatus): SignOffStatus {
  if (raw === "approved" || raw === "rejected") {
    return raw;
  }
  return "pending";
}

function normalizeText(raw?: string): string {
  const value = raw?.trim();
  return value && value.length > 0 ? value : "—";
}

function isApprovedSignOff(state: {
  owner: string;
  status: SignOffStatus;
  approvalRef: string;
  signedAt: string;
}): boolean {
  return (
    state.status === "approved" &&
    state.owner !== "TBD" &&
    state.approvalRef !== "—" &&
    state.signedAt !== "—"
  );
}

function parseIsoTimestamp(value: string, field: string): string {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`invalid ${field}: expected ISO-8601 timestamp`);
  }
  return new Date(parsed).toISOString();
}

function collectSignOffStates(bundle: ReleaseGovernanceEvidenceBundle): GoLiveSignOffState[] {
  return (Object.keys(ROLE_LABELS) as RoleKey[]).map((role) => {
    const rawSignOff = bundle.signOffs?.[role];
    const state: GoLiveSignOffState = {
      role,
      roleLabel: ROLE_LABELS[role],
      owner: owner(rawSignOff?.owner ?? bundle.owners[role]),
      status: normalizeSignOffStatus(rawSignOff?.status),
      approvalRef: normalizeText(rawSignOff?.approvalRef),
      signedAt: normalizeText(rawSignOff?.signedAt),
      notes: normalizeText(rawSignOff?.notes),
      approved: false
    };

    state.approved = isApprovedSignOff(state);
    return state;
  });
}

function buildSignOffDraft(
  role: GoLiveSignOffState,
  bundle: ReleaseGovernanceEvidenceBundle,
  contact?: string
): SignOffRequestDraft {
  const recipient = contact?.trim() || role.owner;
  const subject = `HumanOnly Sprint 7 go-live sign-off request — ${role.roleLabel}`;

  const message = [
    `Hi ${recipient},`,
    "",
    `Requesting your explicit ${role.roleLabel} sign-off for HumanOnly Sprint 7 go-live governance closeout.`,
    `- Cadence run: ${bundle.cadenceRun.runUrl}`,
    `- Evidence bundle: docs/SPRINT_7_RELEASE_EVIDENCE_BUNDLE.md`,
    `- Required decision metadata: status=approved/rejected, approval reference, ISO timestamp`,
    "",
    "Please respond with your decision so we can update the governed evidence bundle.",
    "(Draft only — requires explicit human approval before external sending.)"
  ].join("\n");

  return {
    role: role.role,
    roleLabel: role.roleLabel,
    owner: role.owner,
    contact: contact?.trim() || undefined,
    status: role.status,
    subject,
    message
  };
}

function deriveBlockingItems(gates: GoLiveReadinessGate[], signOffStates: GoLiveSignOffState[]): string[] {
  const gateBlocks = gates
    .filter((gate) => gate.status === "fail")
    .map((gate) => `${gate.gate}: ${gate.details}`);

  const signOffBlocks = signOffStates
    .filter((signOff) => !signOff.approved)
    .map((signOff) => {
      if (signOff.status === "rejected") {
        return `${signOff.roleLabel} sign-off rejected (approvalRef=${signOff.approvalRef})`;
      }
      return `${signOff.roleLabel} sign-off pending`;
    });

  return [...gateBlocks, ...signOffBlocks];
}

function deriveNextActions(
  report: {
    readinessGates: GoLiveReadinessGate[];
    pendingSignOffRequests: SignOffRequestDraft[];
    recommendation: "blocked" | "ready-for-human-decision";
  },
  decision?: GoLiveDecision
): string[] {
  const actions: string[] = [];

  const endpointGate = report.readinessGates.find((gate) => gate.gate.includes("Managed Postgres endpoint"));
  if (endpointGate?.status === "fail") {
    actions.push(
      "Rotate HUMANONLY_MANAGED_POSTGRES_URL to the final external managed endpoint and rerun release-governance cadence."
    );
  }

  if (report.pendingSignOffRequests.length > 0) {
    actions.push(
      "Collect explicit human owner sign-offs and update docs/SPRINT_7_RELEASE_EVIDENCE_BUNDLE.{md,json} with approved/rejected decisions."
    );
  }

  if (report.recommendation === "ready-for-human-decision" && !decision) {
    actions.push("Record final go-live decision with approval reference, owner, and timestamp.");
  }

  if (actions.length === 0) {
    actions.push("No remaining operational blockers.");
  }

  return actions;
}

export function createGoLiveCloseoutReport(
  bundle: ReleaseGovernanceEvidenceBundle,
  options: GoLiveCloseoutOptions = {}
): GoLiveCloseoutReport {
  const readinessGates = evaluateGoLiveReadiness(bundle);
  const signOffStates = collectSignOffStates(bundle);

  const pendingSignOffRequests = signOffStates
    .filter((state) => !state.approved)
    .map((state) => buildSignOffDraft(state, bundle, options.signOffContacts?.[state.role]));

  const blockingItems = deriveBlockingItems(readinessGates, signOffStates);
  const recommendation = blockingItems.length > 0 ? "blocked" : "ready-for-human-decision";

  let decision: GoLiveDecision | undefined;
  if (options.decision) {
    decision = {
      status: options.decision.status,
      approvalRef: normalizeText(options.decision.approvalRef),
      decidedBy: owner(options.decision.decidedBy),
      decidedAt: parseIsoTimestamp(options.decision.decidedAt, "decision timestamp"),
      notes: options.decision.notes?.trim() || undefined
    };

    if (decision.approvalRef === "—") {
      throw new Error("go-live decision requires approvalRef");
    }

    if (decision.decidedBy === "TBD") {
      throw new Error("go-live decision requires decidedBy");
    }

    if (decision.status === "approved" && recommendation !== "ready-for-human-decision") {
      throw new Error("cannot record approved go-live decision while readiness gates are failing");
    }
  }

  let finalOutcome: GoLiveCloseoutReport["finalOutcome"];
  if (decision?.status === "approved") {
    finalOutcome = "go-live-approved";
  } else if (decision?.status === "rejected") {
    finalOutcome = "go-live-rejected";
  } else if (decision?.status === "deferred") {
    finalOutcome = "go-live-deferred";
  } else if (recommendation === "ready-for-human-decision") {
    finalOutcome = "awaiting-human-decision";
  } else {
    finalOutcome = "blocked";
  }

  const report: GoLiveCloseoutReport = {
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    sourceEvidenceGeneratedAt: bundle.generatedAt,
    cadenceRunId: bundle.cadenceRun.runId,
    cadenceRunUrl: bundle.cadenceRun.runUrl,
    readinessGates,
    signOffStates,
    pendingSignOffRequests,
    blockingItems,
    recommendation,
    finalOutcome,
    decision,
    governance: { ...GOVERNANCE_ASSERTIONS },
    nextActions: []
  };

  report.nextActions = deriveNextActions(report, decision);
  return report;
}

function renderReadinessRows(gates: GoLiveReadinessGate[]): string {
  return gates
    .map(
      (gate) =>
        `| ${gate.gate} | ${gate.status === "pass" ? "PASS" : "FAIL"} | ${gate.details.replaceAll("|", "\\|")} |`
    )
    .join("\n");
}

function renderSignOffRows(signOffStates: GoLiveSignOffState[]): string {
  return signOffStates
    .map(
      (signOff) =>
        `| ${signOff.roleLabel} | ${signOff.owner} | ${signOff.status.toUpperCase()} | ${signOff.approvalRef} | ${signOff.signedAt} | ${signOff.notes.replaceAll("|", "\\|")} |`
    )
    .join("\n");
}

export function renderGoLiveCloseoutMarkdown(report: GoLiveCloseoutReport): string {
  const blocking =
    report.blockingItems.length > 0
      ? report.blockingItems.map((item) => `- ${item}`).join("\n")
      : "- None";

  const nextActions =
    report.nextActions.length > 0
      ? report.nextActions.map((item, idx) => `${idx + 1}. ${item}`).join("\n")
      : "1. None";

  const decision = report.decision
    ? `- Status: ${report.decision.status.toUpperCase()}\n- Approval Ref: ${report.decision.approvalRef}\n- Decided by: ${report.decision.decidedBy}\n- Decided at: ${report.decision.decidedAt}\n- Notes: ${report.decision.notes ?? "—"}`
    : "- Not recorded";

  const drafts =
    report.pendingSignOffRequests.length > 0
      ? report.pendingSignOffRequests
          .map((draft, idx) => {
            const recipient = draft.contact ?? draft.owner;
            return [
              `### Draft ${idx + 1}: ${draft.roleLabel}`,
              `- Recipient: ${recipient}`,
              `- Subject: ${draft.subject}`,
              "- Message:",
              "```text",
              draft.message,
              "```"
            ].join("\n");
          })
          .join("\n\n")
      : "No pending sign-off outreach drafts.";

  return `# Sprint 7 Go-Live Governance Closeout Report

Generated: ${report.generatedAt}
Source release evidence generated at: ${report.sourceEvidenceGeneratedAt}
Cadence run: ${report.cadenceRunUrl} (ID: ${report.cadenceRunId})

## Readiness gates
| Gate | Status | Details |
|---|---|---|
${renderReadinessRows(report.readinessGates)}

## Owner sign-off status
| Role | Owner | Decision | Approval Ref | Timestamp | Notes |
|---|---|---|---|---|---|
${renderSignOffRows(report.signOffStates)}

## Blocking items
${blocking}

## Recommendation
- ${report.recommendation === "ready-for-human-decision" ? "READY FOR HUMAN DECISION" : "BLOCKED"}
- Final outcome state: ${report.finalOutcome}

## Recorded go-live decision
${decision}

## External sign-off outreach drafts (approval required before sending)
${drafts}

## Governance assertions
- Human expression only
- AI-managed operations
- Human-governed decisions
- Auditability required
- Human override reserved for admins

## Next actions
${nextActions}
`;
}
