import { NextRequest, NextResponse } from "next/server";
import { requireHumanSession } from "@/lib/auth/guards";
import { writeAuditStub } from "@/lib/audit";
import {
  ContentValidationError,
  createReportRecord,
  parseCreateReportPayload
} from "@/lib/content";
import { db } from "@/lib/store";

export async function GET() {
  const sessionResult = await requireHumanSession("moderator");
  if (!sessionResult.ok) {
    return sessionResult.response;
  }

  const queue = db.reports.filter((report) => report.status !== "resolved");

  await writeAuditStub({
    actorId: sessionResult.session.user.id,
    action: "reports.queue.requested",
    targetType: "moderation_queue",
    metadata: {
      openReports: queue.length,
      role: sessionResult.session.user.role
    },
    createdAt: new Date().toISOString()
  });

  return NextResponse.json({ data: queue });
}

export async function POST(request: NextRequest) {
  const sessionResult = await requireHumanSession("member");
  if (!sessionResult.ok) {
    return sessionResult.response;
  }

  const payload = await request.json().catch(() => null);

  let command;
  try {
    command = parseCreateReportPayload(payload);
  } catch (error) {
    if (error instanceof ContentValidationError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }

    throw error;
  }

  let report;
  try {
    report = createReportRecord(db, {
      postId: command.postId,
      reporterId: sessionResult.session.user.id,
      reason: command.reason
    });
  } catch (error) {
    if (error instanceof ContentValidationError && error.code === "POST_NOT_FOUND") {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 404 });
    }

    throw error;
  }

  await writeAuditStub({
    actorId: sessionResult.session.user.id,
    action: "report.created",
    targetType: "report",
    targetId: report.id,
    metadata: {
      postId: report.postId,
      reasonLength: report.reason.length,
      reporterHandle: sessionResult.session.user.handle
    },
    createdAt: new Date().toISOString()
  });

  return NextResponse.json({ data: report }, { status: 201 });
}
