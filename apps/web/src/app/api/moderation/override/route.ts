import { NextRequest, NextResponse } from "next/server";
import { requireHumanSession } from "@/lib/auth/guards";
import { writeAuditStub } from "@/lib/audit";
import { db, persistStore } from "@/lib/store";
import { OverrideValidationError, parseOverrideCommand } from "@/lib/moderation/override";

export async function POST(request: NextRequest) {
  const sessionResult = await requireHumanSession("admin");
  if (!sessionResult.ok) {
    return sessionResult.response;
  }

  const payload = await request.json().catch(() => null);

  let command;
  try {
    command = parseOverrideCommand(payload);
  } catch (error) {
    if (error instanceof OverrideValidationError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }

    throw error;
  }

  const report = db.reports.find((item) => item.id === command.reportId);
  if (!report) {
    return NextResponse.json({ error: "report not found" }, { status: 404 });
  }

  const previousStatus = report.status;
  report.status = command.status;

  await writeAuditStub({
    actorId: sessionResult.session.user.id,
    action: "moderation.override.applied",
    targetType: "report",
    targetId: report.id,
    metadata: {
      postId: report.postId,
      previousStatus,
      newStatus: command.status,
      reason: command.reason,
      humanConfirmed: command.humanConfirmed,
      role: sessionResult.session.user.role,
      actorHandle: sessionResult.session.user.handle
    },
    createdAt: new Date().toISOString()
  });

  persistStore();

  return NextResponse.json({
    data: {
      id: report.id,
      status: report.status,
      overriddenBy: sessionResult.session.user.id,
      reason: command.reason,
      overriddenAt: new Date().toISOString()
    }
  });
}
