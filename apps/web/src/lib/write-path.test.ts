import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { auditWriteMode, resolveAuditWriteModePolicy } from "@/lib/write-path";

describe("audit write mode policy", () => {
  it("defaults to sync mode when unset", () => {
    const policy = resolveAuditWriteModePolicy({});
    assert.equal(policy.effectiveMode, "sync");
    assert.equal(policy.requestedMode, "sync");
    assert.equal(policy.productionGuardrailApplied, false);
  });

  it("allows async mode outside production", () => {
    const policy = resolveAuditWriteModePolicy({
      HUMANONLY_AUDIT_WRITE_MODE: "async",
      NODE_ENV: "development"
    });

    assert.equal(policy.requestedMode, "async");
    assert.equal(policy.effectiveMode, "async");
    assert.equal(policy.productionGuardrailApplied, false);
  });

  it("forces sync mode in production without explicit approval", () => {
    const policy = resolveAuditWriteModePolicy({
      HUMANONLY_AUDIT_WRITE_MODE: "async",
      NODE_ENV: "production"
    });

    assert.equal(policy.requestedMode, "async");
    assert.equal(policy.effectiveMode, "sync");
    assert.equal(policy.productionGuardrailApplied, true);
  });

  it("allows async mode in production with explicit approval and reference", () => {
    const policy = resolveAuditWriteModePolicy({
      HUMANONLY_AUDIT_WRITE_MODE: "async",
      NODE_ENV: "production",
      HUMANONLY_AUDIT_ASYNC_APPROVED: "1",
      HUMANONLY_AUDIT_ASYNC_APPROVAL_REF: "CAB-2026-03-03"
    });

    assert.equal(policy.effectiveMode, "async");
    assert.equal(policy.productionGuardrailApplied, false);
    assert.equal(policy.approvalReference, "CAB-2026-03-03");
  });

  it("auditWriteMode helper reflects effective mode", () => {
    assert.equal(auditWriteMode({ HUMANONLY_AUDIT_WRITE_MODE: "async", NODE_ENV: "development" }), "async");
    assert.equal(auditWriteMode({ HUMANONLY_AUDIT_WRITE_MODE: "async", NODE_ENV: "production" }), "sync");
  });
});
