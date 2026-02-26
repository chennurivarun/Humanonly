import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { writeAuditStub } from "@/lib/audit";
import { db } from "@/lib/store";

export async function GET() {
  const queue = db.reports.filter((report) => report.status !== "resolved");

  await writeAuditStub({
    actorId: "moderator",
    action: "reports.queue.requested",
    targetType: "moderation_queue",
    metadata: { openReports: queue.length },
    createdAt: new Date().toISOString()
  });

  return NextResponse.json({ data: queue });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body?.postId || !body?.reason) {
    return NextResponse.json({ error: "postId and reason are required" }, { status: 400 });
  }

  const report = {
    id: randomUUID(),
    postId: String(body.postId),
    reporterId: typeof body.reporterId === "string" ? body.reporterId : "anonymous",
    reason: String(body.reason),
    status: "open" as const,
    createdAt: new Date().toISOString()
  };

  db.reports.unshift(report);

  await writeAuditStub({
    actorId: report.reporterId,
    action: "report.created",
    targetType: "report",
    targetId: report.id,
    metadata: { postId: report.postId, reason: report.reason },
    createdAt: new Date().toISOString()
  });

  return NextResponse.json({ data: report }, { status: 201 });
}
