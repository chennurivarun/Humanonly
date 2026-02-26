import { NextResponse } from "next/server";
import { requireHumanSession } from "@/lib/auth/guards";
import { writeAuditStub } from "@/lib/audit";
import { buildAdminMetrics } from "@/lib/admin/metrics";
import { db } from "@/lib/store";

export async function GET() {
  const sessionResult = await requireHumanSession("admin");
  if (!sessionResult.ok) {
    return sessionResult.response;
  }

  const metrics = buildAdminMetrics(db);

  await writeAuditStub({
    actorId: sessionResult.session.user.id,
    action: "admin.metrics.requested",
    targetType: "metrics",
    metadata: {
      reports: metrics.reports.total,
      appeals: metrics.appeals.total,
      users: db.users.length
    },
    createdAt: new Date().toISOString()
  });

  return NextResponse.json({ data: metrics });
}
