import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { writeAuditStub } from "@/lib/audit";
import {
  IdentityAssuranceError,
  parseIdentityAssuranceEvidence,
  verifyIdentityAssuranceEvidence
} from "@/lib/auth/assurance";
import { buildIdentityProfile, OnboardingError, parseOnboardingCredentials } from "@/lib/auth/onboarding";
import { upsertIdentity } from "@/lib/store";

const authSecret =
  process.env.NEXTAUTH_SECRET ??
  (process.env.NODE_ENV === "production" ? undefined : "dev-only-secret-change-before-production");

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: authSecret,
  session: {
    strategy: "jwt"
  },
  pages: {
    signIn: "/onboarding"
  },
  providers: [
    Credentials({
      name: "HumanOnly Onboarding",
      credentials: {
        handle: { label: "Handle", type: "text" },
        displayName: { label: "Display name", type: "text" },
        humanAttestation: { label: "I confirm I am human", type: "text" },
        governanceCommitment: { label: "Governance commitment", type: "text" },
        challengeToken: { label: "Identity challenge token", type: "text" },
        challengeResponse: { label: "Identity challenge response", type: "text" }
      },
      async authorize(credentials) {
        try {
          const parsed = parseOnboardingCredentials(credentials ?? {});
          const assuranceEvidence = parseIdentityAssuranceEvidence(credentials ?? {});
          const assuranceProfile = verifyIdentityAssuranceEvidence(assuranceEvidence);

          const identity = upsertIdentity(buildIdentityProfile(parsed, assuranceProfile));

          await writeAuditStub({
            actorId: identity.id,
            action: "auth.signed_in",
            targetType: "identity",
            targetId: identity.id,
            metadata: {
              handle: identity.handle,
              role: identity.role,
              humanVerifiedAt: identity.humanVerifiedAt,
              identityAssuranceLevel: identity.identityAssuranceLevel,
              identityAssuranceSignals: identity.identityAssuranceSignals,
              identityAssuranceEvaluatedAt: identity.identityAssuranceEvaluatedAt
            },
            createdAt: new Date().toISOString()
          });

          return {
            id: identity.id,
            name: identity.displayName,
            handle: identity.handle,
            role: identity.role,
            humanVerified: true,
            governanceAcceptedAt: identity.governanceAcceptedAt,
            identityAssuranceLevel: identity.identityAssuranceLevel,
            identityAssuranceSignals: identity.identityAssuranceSignals,
            identityAssuranceEvaluatedAt: identity.identityAssuranceEvaluatedAt
          };
        } catch (error) {
          if (error instanceof OnboardingError || error instanceof IdentityAssuranceError) {
            return null;
          }

          throw error;
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.name = user.name;
        token.handle = user.handle;
        token.role = user.role;
        token.humanVerified = user.humanVerified;
        token.governanceAcceptedAt = user.governanceAcceptedAt;
        token.identityAssuranceLevel = user.identityAssuranceLevel;
        token.identityAssuranceSignals = user.identityAssuranceSignals;
        token.identityAssuranceEvaluatedAt = user.identityAssuranceEvaluatedAt;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.name = token.name ?? session.user.name;
        session.user.handle = typeof token.handle === "string" ? token.handle : "";
        session.user.role = token.role === "admin" || token.role === "moderator" ? token.role : "member";
        session.user.humanVerified = token.humanVerified === true;
        session.user.governanceAcceptedAt =
          typeof token.governanceAcceptedAt === "string" ? token.governanceAcceptedAt : "";

        session.user.identityAssuranceLevel =
          token.identityAssuranceLevel === "attested" ||
          token.identityAssuranceLevel === "enhanced" ||
          token.identityAssuranceLevel === "manual_override"
            ? token.identityAssuranceLevel
            : undefined;

        session.user.identityAssuranceSignals = Array.isArray(token.identityAssuranceSignals)
          ? token.identityAssuranceSignals
          : undefined;

        session.user.identityAssuranceEvaluatedAt =
          typeof token.identityAssuranceEvaluatedAt === "string"
            ? token.identityAssuranceEvaluatedAt
            : undefined;
      }

      return session;
    }
  },
  events: {
    async signOut(message) {
      const actorId =
        "token" in message && typeof message.token?.sub === "string" ? message.token.sub : "anonymous";

      await writeAuditStub({
        actorId,
        action: "auth.signed_out",
        targetType: "identity",
        metadata: {
          sessionEnded: true
        },
        createdAt: new Date().toISOString()
      });
    }
  }
});
