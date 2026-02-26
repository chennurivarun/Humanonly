import { NextResponse } from "next/server";
import { requireHumanSession } from "@/lib/auth/guards";
import { writeAuditStub } from "@/lib/audit";
import { computeTrustScore } from "@/lib/trust";
import { db } from "@/lib/store";

export async function GET() {
  const sessionResult = await requireHumanSession("member");
  if (!sessionResult.ok) {
    return sessionResult.response;
  }

  const trust = computeTrustScore(db, sessionResult.session.user.id);

  await writeAuditStub({
    actorId: sessionResult.session.user.id,
    action: "trust.self.requested",
    targetType: "trust_score",
    targetId: sessionResult.session.user.id,
    metadata: {
      score: trust.score,
      tier: trust.tier
    },
    createdAt: new Date().toISOString()
  });

  return NextResponse.json({ data: trust });
}
