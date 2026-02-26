import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { writeAuditStub } from "@/lib/audit";
import { listFeedPage } from "@/lib/content";
import { db } from "@/lib/store";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined;

  const feedPage = listFeedPage(db, {
    cursor,
    limit
  });

  const session = await auth();
  const actorId = session?.user?.id ?? "anonymous";

  await writeAuditStub({
    actorId,
    action: "feed.requested",
    targetType: "feed",
    metadata: {
      cursor,
      limit: feedPage.pageInfo.limit,
      resultCount: feedPage.data.length,
      authenticated: !!session?.user
    },
    createdAt: new Date().toISOString()
  });

  return NextResponse.json(feedPage);
}
