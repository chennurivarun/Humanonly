import { NextRequest, NextResponse } from "next/server";
import { requireHumanSession } from "@/lib/auth/guards";
import { writeAuditStub } from "@/lib/audit";
import { buildModerationInsights } from "@/lib/moderation/insights";
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

function parseTrendWindows(raw: string | null): number[] | undefined {
  if (!raw) {
    return undefined;
  }

  const windows = raw
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value))
    .map((value) => Math.floor(value))
    .filter((value) => value >= 1 && value <= 365);

  return windows.length > 0 ? windows : undefined;
}

export async function GET(request: NextRequest) {
  const sessionResult = await requireHumanSession("moderator");
  if (!sessionResult.ok) {
    return sessionResult.response;
  }

  const queueLimit = parsePositiveInt(request.nextUrl.searchParams.get("queueLimit"), 25, 1, 100);
  const actionLogLimit = parsePositiveInt(request.nextUrl.searchParams.get("actionLogLimit"), 20, 1, 200);
  const trustWatchlistLimit = parsePositiveInt(
    request.nextUrl.searchParams.get("trustWatchlistLimit"),
    10,
    1,
    50
  );
  const trendWindowsDays = parseTrendWindows(request.nextUrl.searchParams.get("windows"));

  const insights = buildModerationInsights(db, {
    queueLimit,
    actionLogLimit,
    trustWatchlistLimit,
    trendWindowsDays
  });

  await writeAuditStub({
    actorId: sessionResult.session.user.id,
    action: "moderation.insights.requested",
    targetType: "metrics",
    metadata: {
      queueLimit,
      actionLogLimit,
      trustWatchlistLimit,
      trendWindowsDays: insights.trends.map((trend) => trend.windowDays),
      role: sessionResult.session.user.role,
      openReports: insights.queueHealth.openReports,
      openAppeals: insights.queueHealth.openAppeals
    },
    createdAt: new Date().toISOString()
  });

  return NextResponse.json({ data: insights });
}
