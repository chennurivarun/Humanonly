import { randomUUID } from "node:crypto";

// ── Types ─────────────────────────────────────────────────────────────────────

export type IncidentSeverity = "sev1" | "sev2" | "sev3";
export type IncidentStatus = "open" | "resolved";

export type Incident = {
  id: string;
  severity: IncidentSeverity;
  title: string;
  description: string;
  declaredById: string;
  declaredAt: string;
  /** True only when an admin has explicitly confirmed this record in the request. */
  humanConfirmed: boolean;
  status: IncidentStatus;
  resolvedAt: string | null;
  resolvedById: string | null;
  resolutionNotes: string | null;
  linkedAuditRecordId: string | null;
};

export type DeclareIncidentInput = {
  severity: IncidentSeverity;
  title: string;
  description: string;
  declaredById: string;
  /** Must be true – caller attests that a human admin has verified this action. */
  humanConfirmed: boolean;
  nowIso?: string;
};

export type ResolveIncidentInput = {
  incidentId: string;
  resolvedById: string;
  resolutionNotes: string;
  /** Must be true – caller attests that a human admin has confirmed resolution. */
  humanConfirmed: boolean;
  nowIso?: string;
};

export type IncidentValidationError = {
  field: string;
  reason: string;
};

// ── In-memory store ───────────────────────────────────────────────────────────

// Incidents are operational runtime state; the immutable audit log is the
// durable record for every declare/resolve action. The in-memory list is
// suitable for pilot drills where restarts reset transient state.
const incidents: Incident[] = [];

export function getIncidents(): readonly Incident[] {
  return incidents;
}

export function resetIncidentsForTests() {
  incidents.length = 0;
}

// ── Validation helpers ────────────────────────────────────────────────────────

const VALID_SEVERITIES: ReadonlySet<string> = new Set<IncidentSeverity>(["sev1", "sev2", "sev3"]);

function validateSeverity(value: unknown): IncidentValidationError | null {
  if (typeof value !== "string" || !VALID_SEVERITIES.has(value)) {
    return { field: "severity", reason: "Must be one of: sev1, sev2, sev3" };
  }
  return null;
}

function validateNonEmptyString(value: unknown, field: string, maxLength: number): IncidentValidationError | null {
  if (typeof value !== "string" || !value.trim()) {
    return { field, reason: `${field} is required` };
  }
  if (value.trim().length > maxLength) {
    return { field, reason: `${field} must be ${maxLength} characters or fewer` };
  }
  return null;
}

function validateHumanConfirmed(value: unknown): IncidentValidationError | null {
  if (value !== true) {
    return {
      field: "humanConfirmed",
      reason: "humanConfirmed must be true — human admin must explicitly confirm this action"
    };
  }
  return null;
}

// ── Domain operations ─────────────────────────────────────────────────────────

export type DeclareIncidentResult =
  | { ok: true; incident: Incident }
  | { ok: false; errors: IncidentValidationError[] };

export function declareIncident(input: DeclareIncidentInput): DeclareIncidentResult {
  const errors: IncidentValidationError[] = [];

  const severityError = validateSeverity(input.severity);
  if (severityError) errors.push(severityError);

  const titleError = validateNonEmptyString(input.title, "title", 200);
  if (titleError) errors.push(titleError);

  const descriptionError = validateNonEmptyString(input.description, "description", 2000);
  if (descriptionError) errors.push(descriptionError);

  const confirmedError = validateHumanConfirmed(input.humanConfirmed);
  if (confirmedError) errors.push(confirmedError);

  if (!input.declaredById?.trim()) {
    errors.push({ field: "declaredById", reason: "declaredById is required" });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const nowIso = input.nowIso ?? new Date().toISOString();

  const incident: Incident = {
    id: `inc_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
    severity: input.severity,
    title: input.title.trim(),
    description: input.description.trim(),
    declaredById: input.declaredById,
    declaredAt: nowIso,
    humanConfirmed: true,
    status: "open",
    resolvedAt: null,
    resolvedById: null,
    resolutionNotes: null,
    linkedAuditRecordId: null
  };

  incidents.unshift(incident);

  return { ok: true, incident };
}

export type ResolveIncidentResult =
  | { ok: true; incident: Incident }
  | { ok: false; errors: IncidentValidationError[] };

export function resolveIncident(input: ResolveIncidentInput): ResolveIncidentResult {
  const errors: IncidentValidationError[] = [];

  const confirmedError = validateHumanConfirmed(input.humanConfirmed);
  if (confirmedError) errors.push(confirmedError);

  const notesError = validateNonEmptyString(input.resolutionNotes, "resolutionNotes", 2000);
  if (notesError) errors.push(notesError);

  if (!input.resolvedById?.trim()) {
    errors.push({ field: "resolvedById", reason: "resolvedById is required" });
  }

  const target = incidents.find((i) => i.id === input.incidentId);
  if (!target) {
    errors.push({ field: "incidentId", reason: "Incident not found" });
  } else if (target.status === "resolved") {
    errors.push({ field: "incidentId", reason: "Incident is already resolved" });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const nowIso = input.nowIso ?? new Date().toISOString();
  const incident = target as Incident;

  incident.status = "resolved";
  incident.resolvedAt = nowIso;
  incident.resolvedById = input.resolvedById;
  incident.resolutionNotes = input.resolutionNotes.trim();

  return { ok: true, incident };
}
