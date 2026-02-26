import { NextRequest, NextResponse } from "next/server";
import { requireHumanSession } from "@/lib/auth/guards";
import { writeAuditStub } from "@/lib/audit";
import {
  declareIncident,
  getIncidents,
  resolveIncident,
  type IncidentSeverity
} from "@/lib/incident";

// ── GET /api/admin/incident ───────────────────────────────────────────────────

export async function GET() {
  const sessionResult = await requireHumanSession("admin");
  if (!sessionResult.ok) {
    return sessionResult.response;
  }

  const nowIso = new Date().toISOString();
  const incidents = getIncidents();

  await writeAuditStub({
    actorId: sessionResult.session.user.id,
    action: "admin.incident.listed",
    targetType: "incident",
    metadata: { total: incidents.length },
    createdAt: nowIso
  });

  return NextResponse.json({ data: incidents });
}

// ── POST /api/admin/incident ──────────────────────────────────────────────────

type DeclareBody = {
  action: "declare";
  severity: IncidentSeverity;
  title: string;
  description: string;
  humanConfirmed: boolean;
};

type ResolveBody = {
  action: "resolve";
  incidentId: string;
  resolutionNotes: string;
  humanConfirmed: boolean;
};

type IncidentBody = DeclareBody | ResolveBody;

export async function POST(req: NextRequest) {
  const sessionResult = await requireHumanSession("admin");
  if (!sessionResult.ok) {
    return sessionResult.response;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Request body must be an object" }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;
  const action = payload.action;

  if (action !== "declare" && action !== "resolve") {
    return NextResponse.json(
      { error: "action must be 'declare' or 'resolve'" },
      { status: 400 }
    );
  }

  const nowIso = new Date().toISOString();
  const actorId = sessionResult.session.user.id;

  // ── Declare ──────────────────────────────────────────────────────────────────

  if (action === "declare") {
    const typed = payload as Partial<DeclareBody>;
    const result = declareIncident({
      severity: typed.severity as IncidentSeverity,
      title: typeof typed.title === "string" ? typed.title : "",
      description: typeof typed.description === "string" ? typed.description : "",
      declaredById: actorId,
      humanConfirmed: typed.humanConfirmed === true,
      nowIso
    });

    if (!result.ok) {
      return NextResponse.json({ error: "Validation failed", errors: result.errors }, { status: 422 });
    }

    await writeAuditStub({
      actorId,
      action: "admin.incident.declared",
      targetType: "incident",
      targetId: result.incident.id,
      metadata: {
        severity: result.incident.severity,
        title: result.incident.title,
        humanConfirmed: result.incident.humanConfirmed
      },
      createdAt: nowIso
    });

    return NextResponse.json({ data: result.incident }, { status: 201 });
  }

  // ── Resolve ──────────────────────────────────────────────────────────────────

  const typed = payload as Partial<ResolveBody>;
  const result = resolveIncident({
    incidentId: typeof typed.incidentId === "string" ? typed.incidentId : "",
    resolvedById: actorId,
    resolutionNotes: typeof typed.resolutionNotes === "string" ? typed.resolutionNotes : "",
    humanConfirmed: typed.humanConfirmed === true,
    nowIso
  });

  if (!result.ok) {
    return NextResponse.json({ error: "Validation failed", errors: result.errors }, { status: 422 });
  }

  await writeAuditStub({
    actorId,
    action: "admin.incident.resolved",
    targetType: "incident",
    targetId: result.incident.id,
    metadata: {
      severity: result.incident.severity,
      humanConfirmed: result.incident.humanConfirmed,
      resolutionNotes: result.incident.resolutionNotes
    },
    createdAt: nowIso
  });

  return NextResponse.json({ data: result.incident });
}
