import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { writeAuditStub } from "@/lib/audit";
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
        humanAttestation: { label: "I confirm I am human", type: "text" }
      },
      async authorize(credentials) {
        try {
          const parsed = parseOnboardingCredentials(credentials ?? {});
          const identity = upsertIdentity(buildIdentityProfile(parsed));

          await writeAuditStub({
            actorId: identity.id,
            action: "auth.signed_in",
            targetType: "identity",
            targetId: identity.id,
            metadata: {
              handle: identity.handle,
              role: identity.role,
              humanVerifiedAt: identity.humanVerifiedAt
            },
            createdAt: new Date().toISOString()
          });

          return {
            id: identity.id,
            name: identity.displayName,
            handle: identity.handle,
            role: identity.role,
            humanVerified: true,
            governanceAcceptedAt: identity.governanceAcceptedAt
          };
        } catch (error) {
          if (error instanceof OnboardingError) {
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
