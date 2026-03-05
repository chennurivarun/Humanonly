import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSignOffManifest } from "@/lib/sign-off-intake";

const baseManifest = {
  releaseManager: {
    owner: "Varun",
    status: "approved",
    approvalRef: "CHANGE-123",
    signedAt: "2026-03-05T10:00:00Z",
    contact: "release.manager@example.com",
    notes: "Final review"
  },
  incidentCommander: {
    status: "pending"
  },
  platformOperator: {
    status: "approved",
    approvalRef: "PO-001",
    signedAt: "2026-03-05T10:05:00Z"
  },
  governanceLead: {
    status: "rejected",
    approvalRef: "GL-001",
    signedAt: "2026-03-05T10:10:00Z"
  }
};

describe("sign-off manifest parsing", () => {
  it("normalizes timestamps and retains optional contact/notes", () => {
    const manifest = parseSignOffManifest(baseManifest, "manifest.json");

    assert.equal(manifest.releaseManager.status, "approved");
    assert.equal(manifest.releaseManager.signedAt, "2026-03-05T10:00:00.000Z");
    assert.equal(manifest.releaseManager.contact, "release.manager@example.com");
    assert.equal(manifest.releaseManager.notes, "Final review");
    assert.equal(manifest.incidentCommander.status, "pending");
    assert.equal(manifest.platformOperator.approvalRef, "PO-001");
  });

  it("throws when required roles are missing", () => {
    const partial = { ...baseManifest };
    delete (partial as Record<string, unknown>).governanceLead;

    assert.throws(() => parseSignOffManifest(partial, "manifest.json"), /missing governanceLead/);
  });

  it("enforces approval metadata for approved/rejected decisions", () => {
    const invalid = {
      ...baseManifest,
      releaseManager: {
        status: "approved"
      }
    };

    assert.throws(() => parseSignOffManifest(invalid, "manifest.json"), /missing manifest\.json\.releaseManager\.approvalRef/);
  });

  it("rejects malformed ISO timestamps", () => {
    const invalidTimestamp = {
      ...baseManifest,
      platformOperator: {
        status: "approved",
        approvalRef: "PO-001",
        signedAt: "not-a-date"
      }
    };

    const nonIsoTimestamp = {
      ...baseManifest,
      platformOperator: {
        status: "approved",
        approvalRef: "PO-002",
        signedAt: "2026-03-05 10:05:00Z"
      }
    };

    assert.throws(() => parseSignOffManifest(invalidTimestamp, "manifest.json"), /invalid manifest\.json\.platformOperator\.signedAt/);
    assert.throws(() => parseSignOffManifest(nonIsoTimestamp, "manifest.json"), /invalid manifest\.json\.platformOperator\.signedAt/);
  });
});
