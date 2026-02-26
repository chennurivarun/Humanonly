import { NextRequest, NextResponse } from "next/server";
import { requireHumanSession } from "@/lib/auth/guards";
import { findAuditRecordById, readAuditLog, writeAuditStub } from "@/lib/audit";
import {
  APPEAL_STATUSES,
  AppealValidationError,
  createAppealRecord,
  parseCreateAppealPayload
} from "@/lib/moderation/appeals";
import { db, persistStore } from "@/lib/store";

const APPEALABLE_ACTIONS = new Set(["report.created", "moderation.override.applied", "appeal.reviewed"] as const);

function selectAppealedAuditRecordId(reportId: string, preferredRecordId?: string): string | undefined {
  const records = readAuditLog();

  if (preferredRecordId) {
    const preferred = findAuditRecordById(preferredRecordId, records);
    if (!preferred || preferred.targetType !== "report" || preferred.targetId !== reportId) {
      return undefined;
    }

    if (!APPEALABLE_ACTIONS.has(preferred.action as (typeof APPEALABLE_ACTIONS extends Set<infer T> ? T : never))) {
      return undefined;
    }

    return preferred.recordId;
  }

  for (let index = records.length - 1; index >= 0; index -= 1) {
    const record = records[index];
    if (!record) {
      continue;
    }

    if (record.targetType === "report" && record.targetId === reportId && APPEALABLE_ACTIONS.has(record.action as never)) {
      return record.recordId;
    }
  }

  return undefined;
}

function parseStatusFilter(raw: string | null): Set<(typeof APPEAL_STATUSES)[number]> {
  if (!raw || raw === "queue") {
    return new Set(["open", "under_review"]);
  }

  if (raw === "all") {
    return new Set(APPEAL_STATUSES);
  }

  const statuses = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const valid = statuses.filter((status): status is (typeof APPEAL_STATUSES)[number] =>
    APPEAL_STATUSES.includes(status as (typeof APPEAL_STATUSES)[number])
  );

  if (valid.length === 0) {
    return new Set(["open", "under_review"]);
  }

  return new Set(valid);
}

export async function GET(request: NextRequest) {
  const sessionResult = await requireHumanSession("moderator");
  if (!sessionResult.ok) {
    return sessionResult.response;
  }

  const statusFilter = parseStatusFilter(request.nextUrl.searchParams.get("status"));
  const appeals = db.appeals
    .filter((appeal) => statusFilter.has(appeal.status))
    .map((appeal) => {
      const report = db.reports.find((candidate) => candidate.id === appeal.reportId) ?? null;
      const appellant = db.users.find((candidate) => candidate.id === appeal.appellantId) ?? null;

      return {
        ...appeal,
        report,
        appellant: appellant
          ? {
              id: appellant.id,
              handle: appellant.handle,
              role: appellant.role
            }
          : null
      };
    });

  await writeAuditStub({
    actorId: sessionResult.session.user.id,
    action: "appeals.queue.requested",
    targetType: "appeal",
    metadata: {
      requestedStatuses: Array.from(statusFilter),
      resultCount: appeals.length,
      role: sessionResult.session.user.role
    },
    createdAt: new Date().toISOString()
  });

  return NextResponse.json({ data: appeals });
}

export async function POST(request: NextRequest) {
  const sessionResult = await requireHumanSession("member");
  if (!sessionResult.ok) {
    return sessionResult.response;
  }

  const payload = await request.json().catch(() => null);

  let command;
  try {
    command = parseCreateAppealPayload(payload);
  } catch (error) {
    if (error instanceof AppealValidationError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }

    throw error;
  }

  const appealedAuditRecordId = selectAppealedAuditRecordId(command.reportId, command.appealedAuditRecordId);
  if (command.appealedAuditRecordId && !appealedAuditRecordId) {
    return NextResponse.json(
      {
        error: "appealedAuditRecordId must reference an immutable audit record on the same report",
        code: "APPEALED_RECORD_INVALID"
      },
      { status: 400 }
    );
  }

  let appeal;
  try {
    appeal = createAppealRecord(
      db,
      {
        reportId: command.reportId,
        appellantId: sessionResult.session.user.id,
        reason: command.reason,
        appealedAuditRecordId
      },
      {
        persist: persistStore
      }
    );
  } catch (error) {
    if (error instanceof AppealValidationError) {
      const status =
        error.code === "REPORT_NOT_FOUND"
          ? 404
          : error.code === "APPEAL_ALREADY_OPEN" || error.code === "APPELLANT_NOT_ELIGIBLE"
            ? 409
            : 400;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }

    throw error;
  }

  const report = db.reports.find((candidate) => candidate.id === appeal.reportId);

  await writeAuditStub({
    actorId: sessionResult.session.user.id,
    action: "appeal.created",
    targetType: "appeal",
    targetId: appeal.id,
    metadata: {
      reportId: appeal.reportId,
      appealedAuditRecordId: appeal.appealedAuditRecordId,
      reportStatusAtSubmission: report?.status,
      appellantHandle: sessionResult.session.user.handle
    },
    createdAt: new Date().toISOString()
  });

  return NextResponse.json({ data: appeal }, { status: 201 });
}
