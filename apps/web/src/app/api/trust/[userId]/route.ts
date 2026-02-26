import { NextRequest, NextResponse } from "next/server";
import { requireHumanSession } from "@/lib/auth/guards";
import { writeAuditStub } from "@/lib/audit";
import { computeTrustScore } from "@/lib/trust";
import { db } from "@/lib/store";

type Params = {
  params: {
    userId: string;
  };
};

export async function GET(_request: NextRequest, { params }: Params) {
  const sessionResult = await requireHumanSession("moderator");
  if (!sessionResult.ok) {
    return sessionResult.response;
  }

  const userId = params.userId;
  const exists = db.users.some((user) => user.id === userId);

  if (!exists) {
    return NextResponse.json({ error: "user not found", code: "USER_NOT_FOUND" }, { status: 404 });
  }

  const trust = computeTrustScore(db, userId);

  await writeAuditStub({
    actorId: sessionResult.session.user.id,
    action: "trust.user.requested",
    targetType: "trust_score",
    targetId: userId,
    metadata: {
      requesterRole: sessionResult.session.user.role,
      score: trust.score,
      tier: trust.tier
    },
    createdAt: new Date().toISOString()
  });

  return NextResponse.json({ data: trust });
}
