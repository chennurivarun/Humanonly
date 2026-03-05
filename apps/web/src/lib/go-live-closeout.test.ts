import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createGoLiveCloseoutReport,
  renderGoLiveCloseoutMarkdown,
  type GoLiveDecision,
  type GoLiveCloseoutReport
} from "@/lib/go-live-closeout";
import type { ReleaseGovernanceEvidenceBundle } from "@/lib/release-governance-evidence";

function makeBundle(): ReleaseGovernanceEvidenceBundle {
  return {
    generatedAt: "2026-03-05T09:06:57.086Z",
    approvalRef: "CHANGE-2026-03-05-MANAGED-SECRET-RUN-RETRY",
    cadenceRun: {
      runId: "22706417635",
      runUrl: "https://github.com/chennurivarun/Humanonly/actions/runs/22706417635",
      targetProfile: "managed",
      executedAt: "2026-03-05T07:07:59Z"
    },
    cutover: {
      plan: {
        generatedAt: "2026-03-04T18:16:20.657Z",
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
        generatedAt: "2026-03-04T18:16:21.327Z",
        action: "apply",
        humanApprovalRef: "CHANGE-2026-03-04-RELEASE-CADENCE",
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
        generatedAt: "2026-03-04T18:16:21.880Z",
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
      generatedAt: "2026-03-05T07:07:59.195Z",
      humanApprovalRef: "CHANGE-2026-03-05-MANAGED-SECRET-RUN-RETRY",
      simulatedNetworkLatencyMs: 12,
      postgresSource: "cli",
      incremental: {
        averageDurationMs: 66.48,
        p95DurationMs: 90.34,
        averageMutatingQueries: 3.1
      },
      fullReconcile: {
        averageDurationMs: 7717.73,
        p95DurationMs: 7796.61,
        averageMutatingQueries: 611
      }
    },
    artifacts: [
      {
        label: "Cadence artifact bundle",
        path: "release-governance-cadence-22706417635",
        url: "https://github.com/chennurivarun/Humanonly/actions/runs/22706417635/artifacts/5774499356"
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
        approvalRef: "CHANGE-RM-001",
        signedAt: "2026-03-05T10:00:00Z"
      },
      incidentCommander: {
        status: "pending"
      },
      platformOperator: {
        status: "approved",
        approvalRef: "CHANGE-PO-001",
        signedAt: "2026-03-05T10:05:00Z"
      },
      governanceLead: {
        status: "pending"
      }
    },
    managedEndpoint: {
      source: "repo-secret",
      url: "postgresql://humanonly:humanonly@localhost:5432/humanonly_release"
    },
    risks: ["Managed endpoint currently targets localhost service container."],
    nextActions: ["Rotate to final managed endpoint."]
  };
}

function makeDecision(status: GoLiveDecision["status"]): GoLiveDecision {
  return {
    status,
    approvalRef: "CHANGE-2026-03-05-GO-LIVE",
    decidedBy: "Release Board",
    decidedAt: "2026-03-05T11:00:00Z",
    notes: "Decision captured in governance board call"
  };
}

describe("go-live closeout report", () => {
  it("builds blocked report with pending sign-off outreach drafts", () => {
    const report = createGoLiveCloseoutReport(makeBundle(), {
      signOffContacts: {
        incidentCommander: "ic@humanonly.org"
      }
    });

    assert.equal(report.recommendation, "blocked");
    assert.equal(report.finalOutcome, "blocked");
    assert.equal(report.pendingSignOffRequests.length, 2);
    assert.match(report.pendingSignOffRequests[0]?.subject ?? "", /go-live sign-off request/);
    assert.equal(report.pendingSignOffRequests[0]?.contact, "ic@humanonly.org");

    const markdown = renderGoLiveCloseoutMarkdown(report);
    assert.match(markdown, /External sign-off outreach drafts/);
    assert.match(markdown, /approval required before sending/);
  });

  it("allows approved decision only when readiness gates pass", () => {
    const bundle = makeBundle();
    bundle.managedEndpoint = {
      source: "repo-secret",
      url: "postgresql://humanonly:supersecret@db.humanonly.io:5432/humanonly"
    };
    bundle.signOffs = {
      releaseManager: {
        status: "approved",
        approvalRef: "CHANGE-RM-001",
        signedAt: "2026-03-05T10:00:00Z"
      },
      incidentCommander: {
        status: "approved",
        approvalRef: "CHANGE-IC-001",
        signedAt: "2026-03-05T10:03:00Z"
      },
      platformOperator: {
        status: "approved",
        approvalRef: "CHANGE-PO-001",
        signedAt: "2026-03-05T10:05:00Z"
      },
      governanceLead: {
        status: "approved",
        approvalRef: "CHANGE-GL-001",
        signedAt: "2026-03-05T10:08:00Z"
      }
    };

    const report = createGoLiveCloseoutReport(bundle, {
      decision: makeDecision("approved")
    });

    assert.equal(report.recommendation, "ready-for-human-decision");
    assert.equal(report.finalOutcome, "go-live-approved");
    assert.equal(report.decision?.decidedAt, "2026-03-05T11:00:00.000Z");
  });

  it("rejects approved decision while readiness gates are failing", () => {
    assert.throws(
      () =>
        createGoLiveCloseoutReport(makeBundle(), {
          decision: makeDecision("approved")
        }),
      /cannot record approved go-live decision while readiness gates are failing/
    );
  });

  it("records rejected decision even when blocked", () => {
    const report = createGoLiveCloseoutReport(makeBundle(), {
      decision: makeDecision("rejected")
    });

    assert.equal(report.finalOutcome, "go-live-rejected");
  });
});
