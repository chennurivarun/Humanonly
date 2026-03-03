import { NextRequest, NextResponse } from "next/server";
import { requireHumanSession } from "@/lib/auth/guards";
import { writeAuditStub } from "@/lib/audit";
import { ContentValidationError, createPostRecord, parseCreatePostPayload } from "@/lib/content";
import { db, persistStore } from "@/lib/store";
import { createWritePathTimer, resolveAuditWriteModePolicy } from "@/lib/write-path";

export async function POST(request: NextRequest) {
  const sessionResult = await requireHumanSession("member");
  if (!sessionResult.ok) {
    return sessionResult.response;
  }

  const timer = createWritePathTimer();
  const payload = await request.json().catch(() => null);

  let command;
  try {
    command = timer.measure("validation", () => parseCreatePostPayload(payload));
  } catch (error) {
    if (error instanceof ContentValidationError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }

    throw error;
  }

  const post = timer.measure("domain", () =>
    createPostRecord(db, {
      authorId: sessionResult.session.user.id,
      body: command.body
    })
  );

  timer.measure("persist", () => persistStore());

  const modePolicy = resolveAuditWriteModePolicy();
  const mode = modePolicy.effectiveMode;
  const writeAudit = () =>
    writeAuditStub({
      actorId: sessionResult.session.user.id,
      action: "post.created",
      targetType: "post",
      targetId: post.id,
      metadata: {
        bodyLength: post.body.length,
        authorHandle: sessionResult.session.user.handle,
        writePath: timer.snapshot(),
        auditMode: mode,
        auditModePolicy: {
          requestedMode: modePolicy.requestedMode,
          effectiveMode: modePolicy.effectiveMode,
          productionGuardrailApplied: modePolicy.productionGuardrailApplied,
          approvalReference: modePolicy.approvalReference
        }
      },
      createdAt: new Date().toISOString()
    });

  if (mode === "async") {
    void timer.measureAsync("audit", writeAudit).catch((error) => {
      console.error("Failed to persist audit event", error);
    });
  } else {
    await timer.measureAsync("audit", writeAudit);
  }

  return NextResponse.json({ data: post }, { status: 201 });
}
