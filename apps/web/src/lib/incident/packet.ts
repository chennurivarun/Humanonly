import { readAuditLog, type AuditAction, type ImmutableAuditRecord } from "@/lib/audit";
import { GOVERNANCE_ASSERTIONS } from "@/lib/governed-store";
import { getIncidents, type Incident } from "@/lib/incident";

export type IncidentPacketAuditReference = {
  recordId: string;
  sequence: number;
  action: AuditAction;
  actorId: string;
  createdAt: string;
  hash: string;
  previousHash: string | null;
  metadata?: Record<string, unknown>;
};

export type IncidentPacketTimelineEvent = {
  at: string;
  eventType: "incident_declared" | "incident_resolved" | "audit_recorded";
  actorId: string;
  summary: string;
  auditRecordId?: string;
};

export type IncidentPacket = {
  packetVersion: 1;
  generatedAt: string;
  incident: Incident;
  auditReferences: IncidentPacketAuditReference[];
  timeline: IncidentPacketTimelineEvent[];
  governanceRationale: {
    assertions: typeof GOVERNANCE_ASSERTIONS;
    policy: string[];
    declarationSummary: string;
    resolutionSummary: string | null;
    pendingDecision: string | null;
  };
};

const INCIDENT_PACKET_ACTIONS: ReadonlySet<AuditAction> = new Set([
  "admin.incident.declared",
  "admin.incident.resolved",
  "admin.incident.packet.exported"
]);

function cloneIncident(incident: Incident): Incident {
  return { ...incident };
}

function toAuditReference(record: ImmutableAuditRecord): IncidentPacketAuditReference {
  return {
    recordId: record.recordId,
    sequence: record.sequence,
    action: record.action,
    actorId: record.actorId,
    createdAt: record.createdAt,
    hash: record.hash,
    previousHash: record.previousHash,
    metadata: record.metadata
  };
}

function sortByTimestamp(a: IncidentPacketTimelineEvent, b: IncidentPacketTimelineEvent): number {
  const left = Date.parse(a.at);
  const right = Date.parse(b.at);

  if (Number.isNaN(left) && Number.isNaN(right)) return 0;
  if (Number.isNaN(left)) return 1;
  if (Number.isNaN(right)) return -1;
  return left - right;
}

function buildTimeline(incident: Incident, auditRefs: IncidentPacketAuditReference[]): IncidentPacketTimelineEvent[] {
  const timeline: IncidentPacketTimelineEvent[] = [
    {
      at: incident.declaredAt,
      eventType: "incident_declared",
      actorId: incident.declaredById,
      summary: `Incident declared (${incident.severity.toUpperCase()}) with explicit human confirmation.`
    }
  ];

  if (incident.status === "resolved" && incident.resolvedAt && incident.resolvedById) {
    timeline.push({
      at: incident.resolvedAt,
      eventType: "incident_resolved",
      actorId: incident.resolvedById,
      summary: incident.resolutionNotes
        ? `Incident resolved with documented rationale: ${incident.resolutionNotes}`
        : "Incident resolved with human confirmation."
    });
  }

  for (const auditRef of auditRefs) {
    timeline.push({
      at: auditRef.createdAt,
      eventType: "audit_recorded",
      actorId: auditRef.actorId,
      summary: `Immutable audit record ${auditRef.sequence} captured for ${auditRef.action}.`,
      auditRecordId: auditRef.recordId
    });
  }

  timeline.sort(sortByTimestamp);

  return timeline;
}

export function buildIncidentPacket(incidentId: string, generatedAt = new Date().toISOString()): IncidentPacket | null {
  const normalizedId = incidentId.trim();
  if (!normalizedId) {
    return null;
  }

  const incident = getIncidents().find((row) => row.id === normalizedId);
  if (!incident) {
    return null;
  }

  const auditReferences = readAuditLog()
    .filter(
      (record) =>
        record.targetType === "incident" &&
        record.targetId === incident.id &&
        INCIDENT_PACKET_ACTIONS.has(record.action)
    )
    .sort((left, right) => left.sequence - right.sequence)
    .map(toAuditReference);

  return {
    packetVersion: 1,
    generatedAt,
    incident: cloneIncident(incident),
    auditReferences,
    timeline: buildTimeline(incident, auditReferences),
    governanceRationale: {
      assertions: { ...GOVERNANCE_ASSERTIONS },
      policy: [
        "Incident actions remain human-governed and require explicit admin confirmation.",
        "AI is limited to operational support; it cannot independently decide incident outcomes.",
        "Each lifecycle transition must be backed by immutable audit records for postmortems and governance review."
      ],
      declarationSummary: incident.description,
      resolutionSummary: incident.resolutionNotes,
      pendingDecision:
        incident.status === "open"
          ? "Incident remains open and requires explicit human resolution approval."
          : null
    }
  };
}
