import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { writeAuditStub } from "@/lib/audit";
import { db } from "@/lib/store";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body?.body || typeof body.body !== "string") {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }

  const authorId = typeof body.authorId === "string" ? body.authorId : "anonymous";
  const post = {
    id: randomUUID(),
    authorId,
    body: body.body.trim(),
    createdAt: new Date().toISOString()
  };

  db.posts.unshift(post);

  await writeAuditStub({
    actorId: authorId,
    action: "post.created",
    targetType: "post",
    targetId: post.id,
    metadata: { bodyLength: post.body.length },
    createdAt: new Date().toISOString()
  });

  return NextResponse.json({ data: post }, { status: 201 });
}
