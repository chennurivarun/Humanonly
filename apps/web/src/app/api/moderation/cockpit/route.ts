import { NextRequest, NextResponse } from "next/server";
import { requireHumanSession } from "@/lib/auth/guards";
import { writeAuditStub } from "@/lib/audit";
import { buildModerationCockpit, type ModerationRiskTier } from "@/lib/moderation/cockpit";
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

function parseQueue(raw: string | null): "all" | "report" | "appeal" {
  if (raw === "report" || raw === "appeal") {
    return raw;
  }

  return "all";
}

function parseStatuses(raw: string | null): string[] {
  if (!raw) {
    return [];
  }

  const allowed = new Set(["open", "triaged", "under_review", "resolved", "upheld", "granted"]);

  return Array.from(
    new Set(
      raw
        .split(",")
        .map((item) => item.trim())
        .filter((item) => allowed.has(item))
    )
  );
}

function parseRiskTiers(raw: string | null): ModerationRiskTier[] {
  if (!raw) {
    return [];
  }

  const allowed = new Set<ModerationRiskTier>(["restricted", "watch", "steady", "trusted"]);

  return Array.from(
    new Set(
      raw
        .split(",")
        .map((item) => item.trim())
        .filter((item): item is ModerationRiskTier => allowed.has(item as ModerationRiskTier))
    )
  );
}

function parseHours(raw: string | null): number | undefined {
  if (!raw) {
    return undefined;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return undefined;
  }

  return parsed;
}

export async function GET(request: NextRequest) {
  const sessionResult = await requireHumanSession("moderator");
  if (!sessionResult.ok) {
    return sessionResult.response;
  }

  const queue = parseQueue(request.nextUrl.searchParams.get("queue"));
  const statuses = parseStatuses(request.nextUrl.searchParams.get("status"));
  const riskTiers = parseRiskTiers(request.nextUrl.searchParams.get("risk"));
  const minAgeHours = parseHours(request.nextUrl.searchParams.get("minAgeHours"));
  const maxAgeHours = parseHours(request.nextUrl.searchParams.get("maxAgeHours"));
  const limit = parsePositiveInt(request.nextUrl.searchParams.get("limit"), 25, 1, 100);

  const snapshot = buildModerationCockpit(db, {
    queue,
    statuses,
    riskTiers,
    minAgeHours,
    maxAgeHours,
    limit
  });

  await writeAuditStub({
    actorId: sessionResult.session.user.id,
    action: "moderation.cockpit.requested",
    targetType: "metrics",
    metadata: {
      queue,
      statuses,
      riskTiers,
      minAgeHours,
      maxAgeHours,
      limit,
      role: sessionResult.session.user.role,
      returnedItems: snapshot.summary.returnedItems,
      breachedTotal: snapshot.summary.sla.breachedTotal
    },
    createdAt: new Date().toISOString()
  });

  return NextResponse.json({ data: snapshot });
}
