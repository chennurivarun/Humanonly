import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyManagedPostgresEndpoint,
  evaluateCadenceGates,
  evaluateGoLiveReadiness,
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
    signOffs: {
      releaseManager: {
        status: "approved",
        approvalRef: "RM-APPROVAL-1",
        signedAt: "2026-03-05T10:00:00.000Z"
      },
      incidentCommander: {
        status: "approved",
        approvalRef: "IC-APPROVAL-1",
        signedAt: "2026-03-05T10:05:00.000Z"
      },
      platformOperator: {
        status: "approved",
        approvalRef: "PO-APPROVAL-1",
        signedAt: "2026-03-05T10:10:00.000Z"
      },
      governanceLead: {
        status: "approved",
        approvalRef: "GL-APPROVAL-1",
        signedAt: "2026-03-05T10:15:00.000Z"
      }
    },
    managedEndpoint: {
      source: "repo-secret",
      url: "postgres://humanonly_user:supersecret@db.humanonly.io:5432/humanonly"
    },
    risks: ["Managed endpoint maintenance window overlaps weekly cadence by 15 minutes."],
    nextActions: ["Attach sign-off screenshot to release ticket."]
  } satisfies ReleaseGovernanceEvidenceBundle;
}

describe("release governance evidence bundle", () => {
  it("marks cadence gates as pass when cutover parity and validation deltas are healthy", () => {
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

  it("classifies managed postgres endpoint source and redacts credentials", () => {
    const assessment = classifyManagedPostgresEndpoint({
      source: "repo-secret",
      url: "postgres://humanonly_user:supersecret@db.humanonly.io:5432/humanonly"
    });

    assert.equal(assessment.classification, "external");
    assert.equal(assessment.host, "db.humanonly.io");
    assert.match(assessment.redactedUrl ?? "", /postgres:\/\/\*\*\*:\*\*\*@db\.humanonly\.io:5432\/humanonly/);
  });

  it("marks go-live readiness as fail when endpoint is loopback or sign-offs are pending", () => {
    const bundle = makeBundle();
    bundle.managedEndpoint = {
      source: "repo-secret",
      url: "postgres://humanonly:humanonly@localhost:5432/humanonly_release"
    };
    bundle.signOffs = {
      releaseManager: {
        status: "approved",
        approvalRef: "RM-APPROVAL-1",
        signedAt: "2026-03-05T10:00:00.000Z"
      },
      incidentCommander: {
        status: "pending"
      },
      platformOperator: {
        status: "approved",
        approvalRef: "PO-APPROVAL-1",
        signedAt: "2026-03-05T10:10:00.000Z"
      },
      governanceLead: {
        status: "pending"
      }
    };

    const gates = evaluateGoLiveReadiness(bundle);
    const endpointGate = gates.find((gate) => gate.gate.includes("Managed Postgres endpoint"));
    const signOffGate = gates.find((gate) => gate.gate.includes("owner sign-offs"));

    assert.equal(endpointGate?.status, "fail");
    assert.equal(signOffGate?.status, "fail");
  });

  it("fails endpoint readiness when endpoint host is external but source is workflow override", () => {
    const bundle = makeBundle();
    bundle.managedEndpoint = {
      source: "workflow-input",
      url: "postgres://humanonly_user:supersecret@db.humanonly.io:5432/humanonly"
    };

    const gates = evaluateGoLiveReadiness(bundle);
    const endpointGate = gates.find((gate) => gate.gate.includes("Managed Postgres endpoint"));

    assert.equal(endpointGate?.status, "fail");
    assert.match(endpointGate?.details ?? "", /source-governance=fail/);
  });

  it("classifies reserved/private endpoint ranges and single-label hosts as non-external", () => {
    const cgnat = classifyManagedPostgresEndpoint({
      source: "repo-secret",
      url: "postgres://humanonly_user:supersecret@100.64.10.10:5432/humanonly"
    });
    const singleLabel = classifyManagedPostgresEndpoint({
      source: "repo-secret",
      url: "postgres://humanonly_user:supersecret@postgres:5432/humanonly"
    });

    assert.equal(cgnat.classification, "private-network");
    assert.equal(singleLabel.classification, "private-network");
  });

  it("marks endpoint as invalid when protocol is not postgres", () => {
    const assessment = classifyManagedPostgresEndpoint({
      source: "repo-secret",
      url: "https://db.humanonly.io:5432/humanonly"
    });

    assert.equal(assessment.classification, "invalid");
    assert.match(assessment.details, /must use postgres:\/\//);
  });

  it("renders markdown with sign-off matrix and endpoint governance", () => {
    const bundle = makeBundle();
    bundle.owners.releaseManager = "";
    bundle.signOffs = {
      releaseManager: {
        status: "pending"
      },
      incidentCommander: {
        status: "approved",
        approvalRef: "IC-APPROVAL-1",
        signedAt: "2026-03-05T10:05:00.000Z"
      }
    };

    const markdown = renderReleaseGovernanceEvidenceMarkdown(bundle);
    assert.match(markdown, /\| Release Manager \| TBD \| PENDING \| — \| — \| — \|/);
    assert.match(markdown, /\| Incident Commander \| Ops Lead \| APPROVED \| IC-APPROVAL-1 \| 2026-03-05T10:05:00.000Z \| — \|/);
    assert.match(markdown, /## Managed endpoint governance/);
    assert.match(markdown, /Endpoint classification: `external`/);
    assert.match(markdown, /## Go-live readiness gates/);
  });
});
