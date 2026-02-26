import type { DefaultSession } from "next-auth";
import type { JWT as BaseJWT } from "next-auth/jwt";
import type { HumanRole } from "@/lib/store";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      handle: string;
      role: HumanRole;
      humanVerified: boolean;
      governanceAcceptedAt: string;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    handle: string;
    role: HumanRole;
    humanVerified: boolean;
    governanceAcceptedAt: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends BaseJWT {
    handle?: string;
    role?: HumanRole;
    humanVerified?: boolean;
    governanceAcceptedAt?: string;
  }
}
