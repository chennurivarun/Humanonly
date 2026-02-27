import { NextRequest, NextResponse } from "next/server";
import { requireHumanSession } from "@/lib/auth/guards";
import { writeAuditStub } from "@/lib/audit";
import { buildIncidentPacket } from "@/lib/incident/packet";

type Params = {
  params: {
    incidentId: string;
  };
};

export async function GET(_request: NextRequest, { params }: Params) {
  const sessionResult = await requireHumanSession("admin");
  if (!sessionResult.ok) {
    return sessionResult.response;
  }

  const incidentId = params.incidentId?.trim();
  if (!incidentId) {
    return NextResponse.json({ error: "incidentId is required" }, { status: 400 });
  }

  const nowIso = new Date().toISOString();

  const preview = buildIncidentPacket(incidentId, nowIso);
  if (!preview) {
    return NextResponse.json({ error: "Incident not found", code: "INCIDENT_NOT_FOUND" }, { status: 404 });
  }

  await writeAuditStub({
    actorId: sessionResult.session.user.id,
    action: "admin.incident.packet.exported",
    targetType: "incident",
    targetId: incidentId,
    metadata: {
      severity: preview.incident.severity,
      status: preview.incident.status,
      referencedAuditRecords: preview.auditReferences.length
    },
    createdAt: nowIso
  });

  const packet = buildIncidentPacket(incidentId, nowIso);
  if (!packet) {
    return NextResponse.json({ error: "Incident not found", code: "INCIDENT_NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({ data: packet });
}
