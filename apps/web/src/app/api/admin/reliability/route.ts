import { NextResponse } from "next/server";
import { requireHumanSession } from "@/lib/auth/guards";
import { writeAuditStub } from "@/lib/audit";
import { buildReliabilityStatus } from "@/lib/reliability";
import { db } from "@/lib/store";

export async function GET() {
  const sessionResult = await requireHumanSession("admin");
  if (!sessionResult.ok) {
    return sessionResult.response;
  }

  const nowIso = new Date().toISOString();
  const status = buildReliabilityStatus(db, { nowIso });

  await writeAuditStub({
    actorId: sessionResult.session.user.id,
    action: "admin.reliability.requested",
    targetType: "reliability",
    metadata: {
      healthy: status.healthy,
      auditChainValid: status.auditChain.chainValid,
      auditTotalRecords: status.auditChain.totalRecords,
      alertsExceeded: status.queueLatency.alerts.filter((a) => a.exceeded).length
    },
    createdAt: nowIso
  });

  return NextResponse.json({ data: status });
}
