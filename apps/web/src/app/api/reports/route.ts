import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireHumanSession } from "@/lib/auth/guards";
import { writeAuditStub } from "@/lib/audit";
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

  const body = await request.json().catch(() => null);
  if (!body?.postId || !body?.reason) {
    return NextResponse.json({ error: "postId and reason are required" }, { status: 400 });
  }

  const report = {
    id: randomUUID(),
    postId: String(body.postId),
    reporterId: sessionResult.session.user.id,
    reason: String(body.reason),
    status: "open" as const,
    createdAt: new Date().toISOString()
  };

  db.reports.unshift(report);

  await writeAuditStub({
    actorId: sessionResult.session.user.id,
    action: "report.created",
    targetType: "report",
    targetId: report.id,
    metadata: {
      postId: report.postId,
      reason: report.reason,
      reporterHandle: sessionResult.session.user.handle
    },
    createdAt: new Date().toISOString()
  });

  return NextResponse.json({ data: report }, { status: 201 });
}
