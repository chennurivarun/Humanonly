import { NextRequest, NextResponse } from "next/server";
import { requireHumanSession } from "@/lib/auth/guards";
import { writeAuditStub } from "@/lib/audit";
import { ContentValidationError, createPostRecord, parseCreatePostPayload } from "@/lib/content";
import { db, persistStore } from "@/lib/store";

export async function POST(request: NextRequest) {
  const sessionResult = await requireHumanSession("member");
  if (!sessionResult.ok) {
    return sessionResult.response;
  }

  const payload = await request.json().catch(() => null);

  let command;
  try {
    command = parseCreatePostPayload(payload);
  } catch (error) {
    if (error instanceof ContentValidationError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }

    throw error;
  }

  const post = createPostRecord(
    db,
    {
      authorId: sessionResult.session.user.id,
      body: command.body
    },
    {
      persist: persistStore
    }
  );

  await writeAuditStub({
    actorId: sessionResult.session.user.id,
    action: "post.created",
    targetType: "post",
    targetId: post.id,
    metadata: {
      bodyLength: post.body.length,
      authorHandle: sessionResult.session.user.handle
    },
    createdAt: new Date().toISOString()
  });

  return NextResponse.json({ data: post }, { status: 201 });
}
