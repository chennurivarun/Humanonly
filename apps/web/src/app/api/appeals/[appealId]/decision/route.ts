import { NextRequest, NextResponse } from "next/server";
import { requireHumanSession } from "@/lib/auth/guards";
import { writeAuditStub } from "@/lib/audit";
import {
  AppealValidationError,
  applyAppealDecision,
  parseReviewAppealPayload
} from "@/lib/moderation/appeals";
import { db, persistStore } from "@/lib/store";

type Params = {
  params: {
    appealId: string;
  };
};

export async function POST(request: NextRequest, { params }: Params) {
  const sessionResult = await requireHumanSession("moderator");
  if (!sessionResult.ok) {
    return sessionResult.response;
  }

  const payload = await request.json().catch(() => null);

  let command;
  try {
    command = parseReviewAppealPayload(payload, params.appealId);
  } catch (error) {
    if (error instanceof AppealValidationError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }

    throw error;
  }

  let result;
  try {
    result = applyAppealDecision(
      db,
      {
        ...command,
        reviewerId: sessionResult.session.user.id
      },
      {
        persist: persistStore
      }
    );
  } catch (error) {
    if (error instanceof AppealValidationError) {
      const status =
        error.code === "APPEAL_NOT_FOUND" || error.code === "REPORT_NOT_FOUND"
          ? 404
          : error.code === "APPEAL_ALREADY_DECIDED"
            ? 409
            : 400;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }

    throw error;
  }

  await writeAuditStub({
    actorId: sessionResult.session.user.id,
    action: "appeal.reviewed",
    targetType: "appeal",
    targetId: result.appeal.id,
    metadata: {
      reportId: result.appeal.reportId,
      decision: command.decision,
      previousAppealStatus: result.previousAppealStatus,
      newAppealStatus: result.appeal.status,
      previousReportStatus: result.previousReportStatus,
      newReportStatus: result.report.status,
      reportReopened: result.reportReopened,
      reason: command.reason,
      humanConfirmed: command.humanConfirmed,
      reviewerRole: sessionResult.session.user.role,
      reviewerHandle: sessionResult.session.user.handle
    },
    createdAt: new Date().toISOString()
  });

  return NextResponse.json({
    data: {
      appeal: result.appeal,
      report: {
        id: result.report.id,
        status: result.report.status
      }
    }
  });
}
