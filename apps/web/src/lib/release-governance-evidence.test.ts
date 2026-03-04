import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  evaluateCadenceGates,
  renderReleaseGovernanceEvidenceMarkdown,
  type ReleaseGovernanceEvidenceBundle
} from "@/lib/release-governance-evidence";

function makeBundle(): ReleaseGovernanceEvidenceBundle {
  return {
    generatedAt: "2026-03-04T18:00:00.000Z",
    approvalRef: "CHANGE-2026-03-04-CADENCE",
    cadenceRun: {
      runId: "123456789",
      runUrl: "https://github.com/chennurivarun/Humanonly/actions/runs/123456789",
      targetProfile: "managed",
      executedAt: "2026-03-04T17:58:00.000Z"
    },
    cutover: {
      plan: {
        generatedAt: "2026-03-04T17:40:00.000Z",
        action: "plan",
        productionGuardrails: {
          humanExpressionOnly: true,
          aiManagedOperationsOnly: true,
          humanGovernedDecisionsOnly: true,
          auditabilityRequired: true,
          humanOverrideReservedForAdmins: true,
          writeActionExecuted: false
        }
      },
      apply: {
        generatedAt: "2026-03-04T17:45:00.000Z",
        action: "apply",
        humanApprovalRef: "CHANGE-2026-03-04-CADENCE",
        parity: {
          countsMatch: true,
          fingerprintMatch: true
        },
        productionGuardrails: {
          humanExpressionOnly: true,
          aiManagedOperationsOnly: true,
          humanGovernedDecisionsOnly: true,
          auditabilityRequired: true,
          humanOverrideReservedForAdmins: true,
          writeActionExecuted: true
        }
      },
      verify: {
        generatedAt: "2026-03-04T17:47:00.000Z",
        action: "verify",
        parity: {
          countsMatch: true,
          fingerprintMatch: true
        },
        productionGuardrails: {
          humanExpressionOnly: true,
          aiManagedOperationsOnly: true,
          humanGovernedDecisionsOnly: true,
          auditabilityRequired: true,
          humanOverrideReservedForAdmins: true,
          writeActionExecuted: false
        }
      }
    },
    managedValidation: {
      generatedAt: "2026-03-04T17:55:00.000Z",
      humanApprovalRef: "CHANGE-2026-03-04-CADENCE",
      simulatedNetworkLatencyMs: 12,
      postgresSource: "env",
      incremental: {
        averageDurationMs: 70,
        p95DurationMs: 91,
        averageMutatingQueries: 3
      },
      fullReconcile: {
        averageDurationMs: 8450,
        p95DurationMs: 8690,
        averageMutatingQueries: 611
      }
    },
    artifacts: [
      {
        label: "Cutover plan",
        path: ".tmp/release-cadence/cutover-plan.json",
        url: "https://github.com/chennurivarun/Humanonly/actions/runs/123456789/artifacts/1"
      },
      {
        label: "Managed validation report",
        path: ".tmp/release-cadence/perf-postgres-managed.json"
      }
    ],
    owners: {
      releaseManager: "Varun",
      incidentCommander: "Ops Lead",
      platformOperator: "Platform Team",
      governanceLead: "Governance Council"
    },
    risks: ["Managed endpoint maintenance window overlaps weekly cadence by 15 minutes."],
    nextActions: ["Attach sign-off screenshot to release ticket."]
  } satisfies ReleaseGovernanceEvidenceBundle;
}

describe("release governance evidence bundle", () => {
  it("marks gates as pass when cutover parity and validation deltas are healthy", () => {
    const gates = evaluateCadenceGates(makeBundle());
    assert.equal(gates.every((gate) => gate.status === "pass"), true);
  });

  it("marks parity gate as fail when verify parity drifts", () => {
    const bundle = makeBundle();
    bundle.cutover.verify.parity = {
      countsMatch: true,
      fingerprintMatch: false
    };

    const gates = evaluateCadenceGates(bundle);
    const parityGate = gates.find((gate) => gate.gate === "Cutover parity verification");
    assert.equal(parityGate?.status, "fail");
  });

  it("renders markdown with linked artifacts and owner fallback", () => {
    const bundle = makeBundle();
    bundle.owners.releaseManager = "";
    bundle.owners.incidentCommander = "Incident Lead";

    const markdown = renderReleaseGovernanceEvidenceMarkdown(bundle);
    assert.match(markdown, /\| Release Manager \| TBD \| ☐ \|/);
    assert.match(markdown, /\| Incident Commander \| Incident Lead \| ☐ \|/);
    assert.match(markdown, /\[\.tmp\/release-cadence\/cutover-plan\.json\]\(https:\/\/github\.com\/chennurivarun\/Humanonly\/actions\/runs\/123456789\/artifacts\/1\)/);
    assert.match(markdown, /Managed validation report: \.tmp\/release-cadence\/perf-postgres-managed\.json/);
  });
});
