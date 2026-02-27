import { NextResponse } from "next/server";
import { issueIdentityChallenge } from "@/lib/auth/assurance";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const challenge = issueIdentityChallenge();

  return NextResponse.json(
    { data: challenge },
    {
      headers: {
        "cache-control": "no-store"
      }
    }
  );
}
