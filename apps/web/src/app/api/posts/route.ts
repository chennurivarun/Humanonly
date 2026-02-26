import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireHumanSession } from "@/lib/auth/guards";
import { writeAuditStub } from "@/lib/audit";
import { db } from "@/lib/store";

export async function POST(request: NextRequest) {
  const sessionResult = await requireHumanSession("member");
  if (!sessionResult.ok) {
    return sessionResult.response;
  }

  const body = await request.json().catch(() => null);
  if (!body?.body || typeof body.body !== "string") {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }

  const message = body.body.trim();
  if (!message) {
    return NextResponse.json({ error: "body cannot be empty" }, { status: 400 });
  }

  const post = {
    id: randomUUID(),
    authorId: sessionResult.session.user.id,
    body: message,
    createdAt: new Date().toISOString()
  };

  db.posts.unshift(post);

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
