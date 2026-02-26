import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

describe("audit persistence", () => {
  it("writes immutable chained audit records and detects tampering", async () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), "humanonly-audit-"));
    process.env.HUMANONLY_AUDIT_LOG_FILE = path.join(tempDir, "audit.jsonl");

    const { readAuditLog, resetAuditStateForTests, verifyAuditLogChain, writeAuditStub } = await import("./audit");

    resetAuditStateForTests();

    await writeAuditStub({
      actorId: "usr_1",
      action: "post.created",
      targetType: "post",
      targetId: "pst_1",
      metadata: { bodyLength: 24 },
      createdAt: "2026-02-01T00:00:00.000Z"
    });

    await writeAuditStub({
      actorId: "usr_2",
      action: "report.created",
      targetType: "report",
      targetId: "rpt_1",
      metadata: { postId: "pst_1" },
      createdAt: "2026-02-01T00:01:00.000Z"
    });

    const records = readAuditLog();
    assert.equal(records.length, 2);
    assert.equal(records[0]?.sequence, 1);
    assert.equal(records[1]?.sequence, 2);
    assert.equal(records[1]?.previousHash, records[0]?.hash ?? null);

    const verification = verifyAuditLogChain(records);
    assert.deepEqual(verification, { valid: true });

    const tampered = records.map((record) => ({ ...record }));
    assert.ok(tampered[1]);

    tampered[1].metadata = {
      ...(tampered[1].metadata ?? {}),
      forged: true
    };

    const tamperedVerification = verifyAuditLogChain(tampered);
    assert.equal(tamperedVerification.valid, false);
  });
});
