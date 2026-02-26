import { createHash, randomUUID } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

export type AuditAction =
  | "auth.signed_in"
  | "auth.signed_out"
  | "auth.session.denied"
  | "post.created"
  | "feed.requested"
  | "report.created"
  | "reports.queue.requested"
  | "moderation.override.applied";

export type AuditTargetType = "identity" | "authorization" | "post" | "feed" | "report" | "moderation_queue";

export type AuditRecord = {
  actorId: string;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type ImmutableAuditRecord = AuditRecord & {
  schemaVersion: 1;
  recordId: string;
  sequence: number;
  previousHash: string | null;
  hash: string;
};

const DEFAULT_AUDIT_LOG_FILE = ".data/audit-log.jsonl";
const AUDIT_SCHEMA_VERSION = 1 as const;

let cachedAuditState: { sequence: number; hash: string | null } | null = null;
let writeQueue: Promise<void> = Promise.resolve();

function resolveAuditFilePath(): string {
  const configured = process.env.HUMANONLY_AUDIT_LOG_FILE?.trim() || DEFAULT_AUDIT_LOG_FILE;
  return path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured);
}

function ensureAuditDirectory(filePath: string) {
  mkdirSync(path.dirname(filePath), { recursive: true });
}

function readLastAuditState(filePath: string): { sequence: number; hash: string | null } {
  if (!existsSync(filePath)) {
    return { sequence: 0, hash: null };
  }

  const raw = readFileSync(filePath, "utf8");
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { sequence: 0, hash: null };
  }

  const lastEntry = parseImmutableAuditRecord(JSON.parse(lines[lines.length - 1] as string));

  return {
    sequence: lastEntry.sequence,
    hash: lastEntry.hash
  };
}

function hashAuditRecord(record: Omit<ImmutableAuditRecord, "hash">): string {
  const digest = createHash("sha256");
  digest.update(JSON.stringify(record));
  return digest.digest("hex");
}

function parseImmutableAuditRecord(payload: unknown): ImmutableAuditRecord {
  if (!payload || typeof payload !== "object") {
    throw new Error("Audit record must be an object");
  }

  const row = payload as Record<string, unknown>;

  if (row.schemaVersion !== AUDIT_SCHEMA_VERSION) {
    throw new Error("Unsupported audit schema version");
  }

  if (typeof row.recordId !== "string" || !row.recordId) {
    throw new Error("Invalid audit recordId");
  }

  if (typeof row.sequence !== "number" || !Number.isInteger(row.sequence) || row.sequence < 1) {
    throw new Error("Invalid audit sequence");
  }

  if (row.previousHash !== null && typeof row.previousHash !== "string") {
    throw new Error("Invalid previousHash");
  }

  if (typeof row.hash !== "string" || !row.hash) {
    throw new Error("Invalid audit hash");
  }

  if (typeof row.actorId !== "string" || !row.actorId) {
    throw new Error("Invalid actorId");
  }

  if (typeof row.action !== "string" || !row.action) {
    throw new Error("Invalid action");
  }

  if (typeof row.targetType !== "string" || !row.targetType) {
    throw new Error("Invalid targetType");
  }

  if (row.targetId !== undefined && typeof row.targetId !== "string") {
    throw new Error("Invalid targetId");
  }

  if (row.metadata !== undefined && (typeof row.metadata !== "object" || row.metadata === null)) {
    throw new Error("Invalid metadata payload");
  }

  if (typeof row.createdAt !== "string" || Number.isNaN(Date.parse(row.createdAt))) {
    throw new Error("Invalid createdAt timestamp");
  }

  return {
    schemaVersion: AUDIT_SCHEMA_VERSION,
    recordId: row.recordId,
    sequence: row.sequence,
    previousHash: row.previousHash,
    hash: row.hash,
    actorId: row.actorId,
    action: row.action as AuditAction,
    targetType: row.targetType as AuditTargetType,
    targetId: row.targetId,
    metadata: row.metadata as Record<string, unknown> | undefined,
    createdAt: new Date(row.createdAt).toISOString()
  };
}

function appendImmutableAuditRecord(filePath: string, record: ImmutableAuditRecord) {
  appendFileSync(filePath, `${JSON.stringify(record)}\n`, "utf8");
}

function enqueueAuditWrite(task: () => void): Promise<void> {
  writeQueue = writeQueue.then(
    () => {
      task();
    },
    () => {
      task();
    }
  );

  return writeQueue;
}

export async function writeAuditStub(record: AuditRecord): Promise<void> {
  return enqueueAuditWrite(() => {
    const filePath = resolveAuditFilePath();
    ensureAuditDirectory(filePath);

    const previousState = cachedAuditState ?? readLastAuditState(filePath);
    const nextSequence = previousState.sequence + 1;

    const immutableBase: Omit<ImmutableAuditRecord, "hash"> = {
      schemaVersion: AUDIT_SCHEMA_VERSION,
      recordId: randomUUID(),
      sequence: nextSequence,
      previousHash: previousState.hash,
      actorId: record.actorId,
      action: record.action,
      targetType: record.targetType,
      targetId: record.targetId,
      metadata: record.metadata,
      createdAt: new Date(record.createdAt).toISOString()
    };

    const immutableRecord: ImmutableAuditRecord = {
      ...immutableBase,
      hash: hashAuditRecord(immutableBase)
    };

    appendImmutableAuditRecord(filePath, immutableRecord);
    cachedAuditState = {
      sequence: immutableRecord.sequence,
      hash: immutableRecord.hash
    };
  });
}

export function readAuditLog(filePath = resolveAuditFilePath()): ImmutableAuditRecord[] {
  if (!existsSync(filePath)) {
    return [];
  }

  const raw = readFileSync(filePath, "utf8");
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.map((line, index) => {
    try {
      return parseImmutableAuditRecord(JSON.parse(line));
    } catch (error) {
      throw new Error(`Invalid audit record at line ${index + 1}: ${(error as Error).message}`);
    }
  });
}

export function verifyAuditLogChain(records: ImmutableAuditRecord[]): { valid: true } | { valid: false; reason: string } {
  let previousHash: string | null = null;

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index] as ImmutableAuditRecord;

    if (record.sequence !== index + 1) {
      return {
        valid: false,
        reason: `Invalid sequence at index ${index}: expected ${index + 1}, received ${record.sequence}`
      };
    }

    if (record.previousHash !== previousHash) {
      return {
        valid: false,
        reason: `Invalid previousHash at sequence ${record.sequence}`
      };
    }

    const expectedHash = hashAuditRecord({
      schemaVersion: record.schemaVersion,
      recordId: record.recordId,
      sequence: record.sequence,
      previousHash: record.previousHash,
      actorId: record.actorId,
      action: record.action,
      targetType: record.targetType,
      targetId: record.targetId,
      metadata: record.metadata,
      createdAt: record.createdAt
    });

    if (record.hash !== expectedHash) {
      return {
        valid: false,
        reason: `Hash mismatch at sequence ${record.sequence}`
      };
    }

    previousHash = record.hash;
  }

  return { valid: true };
}
