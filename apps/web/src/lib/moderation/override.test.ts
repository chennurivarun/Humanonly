import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { OverrideValidationError, parseOverrideCommand } from "./override";

describe("parseOverrideCommand", () => {
  it("accepts a valid override payload", () => {
    const parsed = parseOverrideCommand({
      reportId: "rpt_123",
      status: "resolved",
      reason: "False positive after manual verification",
      humanConfirmed: true
    });

    assert.equal(parsed.reportId, "rpt_123");
    assert.equal(parsed.status, "resolved");
  });

  it("rejects unsupported statuses", () => {
    assert.throws(
      () =>
        parseOverrideCommand({
          reportId: "rpt_123",
          status: "open",
          reason: "No-op",
          humanConfirmed: true
        }),
      (error) => error instanceof OverrideValidationError && error.code === "INVALID_STATUS"
    );
  });

  it("requires explicit human confirmation", () => {
    assert.throws(
      () =>
        parseOverrideCommand({
          reportId: "rpt_123",
          status: "triaged",
          reason: "Escalating to legal",
          humanConfirmed: false
        }),
      (error) => error instanceof OverrideValidationError && error.code === "HUMAN_CONFIRMATION_REQUIRED"
    );
  });
});
