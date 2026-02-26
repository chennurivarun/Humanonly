import type { Session } from "next-auth";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { writeAuditStub } from "@/lib/audit";
import type { HumanRole } from "@/lib/store";

const ROLE_WEIGHT: Record<HumanRole, number> = {
  member: 1,
  moderator: 2,
  admin: 3
};

type AuthenticatedSession = Session & {
  user: NonNullable<Session["user"]> & {
    id: string;
    handle: string;
    role: HumanRole;
    humanVerified: boolean;
    governanceAcceptedAt: string;
  };
};

type GuardSuccess = {
  ok: true;
  session: AuthenticatedSession;
};

type GuardFailure = {
  ok: false;
  response: NextResponse;
};

function hasRequiredRole(actual: HumanRole, required: HumanRole): boolean {
  return ROLE_WEIGHT[actual] >= ROLE_WEIGHT[required];
}

async function deniedResponse(status: 401 | 403, reason: string, actorId = "anonymous") {
  await writeAuditStub({
    actorId,
    action: "auth.session.denied",
    targetType: "authorization",
    metadata: { status, reason },
    createdAt: new Date().toISOString()
  });

  return NextResponse.json({ error: reason }, { status });
}

export async function requireHumanSession(minimumRole: HumanRole = "member"): Promise<GuardSuccess | GuardFailure> {
  const session = await auth();

  if (!session?.user) {
    return {
      ok: false,
      response: await deniedResponse(401, "Authentication required")
    };
  }

  const typedUser = session.user as AuthenticatedSession["user"];

  if (!typedUser.humanVerified) {
    return {
      ok: false,
      response: await deniedResponse(403, "Human verification required", typedUser.id)
    };
  }

  if (!hasRequiredRole(typedUser.role, minimumRole)) {
    return {
      ok: false,
      response: await deniedResponse(403, `${minimumRole} role required`, typedUser.id)
    };
  }

  return {
    ok: true,
    session: {
      ...session,
      user: typedUser
    }
  };
}
