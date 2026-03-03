import { NextRequest, NextResponse } from "next/server";
import { requireHumanSession } from "@/lib/auth/guards";
import { writeAuditStub } from "@/lib/audit";
import {
  applyModerationHandoff,
  ModerationHandoffValidationError,
  parseModerationHandoffPayload
} from "@/lib/moderation/handoff";
import { db, persistStore } from "@/lib/store";

export async function POST(request: NextRequest) {
  const sessionResult = await requireHumanSession("moderator");
  if (!sessionResult.ok) {
    return sessionResult.response;
  }

  const payload = await request.json().catch(() => null);

  let command;
  try {
    command = parseModerationHandoffPayload(payload);
  } catch (error) {
    if (error instanceof ModerationHandoffValidationError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }

    throw error;
  }

  let result;
  try {
    result = applyModerationHandoff(db, command, {
      persist: persistStore
    });
  } catch (error) {
    if (error instanceof ModerationHandoffValidationError) {
      const status = error.code === "TARGET_NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }

    throw error;
  }

  await writeAuditStub({
    actorId: sessionResult.session.user.id,
    action: "moderation.handoff.recorded",
    targetType: "moderation_queue",
    targetId: result.targetId,
    metadata: {
      targetType: result.targetType,
      targetId: result.targetId,
      action: result.action,
      templateId: result.template.id,
      handoffToRole: result.handoffToRole,
      note: result.note,
      previousStatus: result.previousStatus,
      nextStatus: result.nextStatus,
      statusChanged: result.statusChanged,
      humanConfirmed: command.humanConfirmed,
      actorRole: sessionResult.session.user.role,
      actorHandle: sessionResult.session.user.handle,
      reportId: result.targetType === "report" ? result.targetId : undefined,
      appealId: result.targetType === "appeal" ? result.targetId : undefined
    },
    createdAt: new Date().toISOString()
  });

  return NextResponse.json({
    data: {
      ...result,
      recordedById: sessionResult.session.user.id,
      recordedByHandle: sessionResult.session.user.handle,
      recordedAt: new Date().toISOString()
    }
  });
}
