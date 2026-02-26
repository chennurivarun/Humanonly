import { NextRequest, NextResponse } from "next/server";
import { requireHumanSession } from "@/lib/auth/guards";
import { writeAuditStub } from "@/lib/audit";
import { buildModerationActionLog } from "@/lib/moderation/action-log";
import { db } from "@/lib/store";

function parsePositiveInt(raw: string | null, fallback: number, min: number, max: number): number {
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  const rounded = Math.floor(parsed);
  return Math.min(Math.max(rounded, min), max);
}

export async function GET(request: NextRequest) {
  const sessionResult = await requireHumanSession("moderator");
  if (!sessionResult.ok) {
    return sessionResult.response;
  }

  const limit = parsePositiveInt(request.nextUrl.searchParams.get("limit"), 50, 1, 200);
  const beforeSequence = request.nextUrl.searchParams.get("beforeSequence");
  const reportId = request.nextUrl.searchParams.get("reportId")?.trim() || undefined;
  const appealId = request.nextUrl.searchParams.get("appealId")?.trim() || undefined;

  const result = buildModerationActionLog(db, {
    limit,
    beforeSequence: beforeSequence ? parsePositiveInt(beforeSequence, 0, 1, Number.MAX_SAFE_INTEGER) : undefined,
    reportId,
    appealId
  });

  await writeAuditStub({
    actorId: sessionResult.session.user.id,
    action: "moderation.action_log.requested",
    targetType: "audit_log",
    metadata: {
      reportId,
      appealId,
      limit,
      resultCount: result.entries.length,
      chainValid: result.chain.valid,
      role: sessionResult.session.user.role
    },
    createdAt: new Date().toISOString()
  });

  return NextResponse.json({
    data: result.entries,
    pageInfo: result.pageInfo,
    chain: result.chain
  });
}
