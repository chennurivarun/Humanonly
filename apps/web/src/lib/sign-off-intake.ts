import { SignOffRole, SIGN_OFF_ROLES, SignOffStatus, isSignOffStatus } from "./sign-off-domain";

export type SignOffManifestEntry = {
  owner?: string;
  status: SignOffStatus;
  approvalRef?: string;
  signedAt?: string;
  contact?: string;
  notes?: string;
};

export type SignOffManifest = Record<SignOffRole, SignOffManifestEntry>;

function trimString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

function parseIsoTimestamp(value: string, label: string): string {
  if (!ISO_TIMESTAMP_PATTERN.test(value)) {
    throw new Error(`invalid ${label}: expected ISO-8601 timestamp`);
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`invalid ${label}: expected ISO-8601 timestamp`);
  }
  return new Date(parsed).toISOString();
}

function parseSignedAt(raw: unknown, role: SignOffRole, source: string): string | undefined {
  const trimmed = trimString(raw);
  if (!trimmed) {
    return undefined;
  }
  return parseIsoTimestamp(trimmed, `${source}.${role}.signedAt`);
}

function parseEntry(raw: unknown, role: SignOffRole, source: string): SignOffManifestEntry {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error(`invalid ${source}.${role}: expected object`);
  }

  const untyped = raw as Record<string, unknown>;
  const statusRaw = trimString(untyped.status);
  if (!statusRaw) {
    throw new Error(`missing ${source}.${role}.status`);
  }

  const normalizedStatus = statusRaw.toLowerCase();
  if (!isSignOffStatus(normalizedStatus)) {
    throw new Error(`invalid ${source}.${role}.status: ${statusRaw}`);
  }
  const status = normalizedStatus as SignOffStatus;

  const approvalRef = trimString(untyped.approvalRef);
  const signedAt = parseSignedAt(untyped.signedAt, role, source);

  if (normalizedStatus !== "pending") {
    if (!approvalRef) {
      throw new Error(`missing ${source}.${role}.approvalRef for ${normalizedStatus} sign-off`);
    }
    if (!signedAt) {
      throw new Error(`missing ${source}.${role}.signedAt for ${normalizedStatus} sign-off`);
    }
  }

  return {
    owner: trimString(untyped.owner),
    status,
    approvalRef,
    signedAt,
    contact: trimString(untyped.contact),
    notes: trimString(untyped.notes)
  };
}

export function parseSignOffManifest(raw: unknown, source = "sign-off manifest"): SignOffManifest {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error(`invalid ${source}: expected object at top level`);
  }

  const entries = raw as Record<string, unknown>;
  const manifest = {} as SignOffManifest;

  for (const role of SIGN_OFF_ROLES) {
    const entry = entries[role];
    if (entry === undefined) {
      throw new Error(`missing ${role} entry in ${source}`);
    }
    manifest[role] = parseEntry(entry, role, source);
  }

  return manifest;
}

export function manifestContactChannels(manifest: SignOffManifest): Partial<Record<SignOffRole, string>> {
  const channels: Partial<Record<SignOffRole, string>> = {};
  for (const role of SIGN_OFF_ROLES) {
    const contact = manifest[role].contact;
    if (contact) {
      channels[role] = contact;
    }
  }
  return channels;
}
