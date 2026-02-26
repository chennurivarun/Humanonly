import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { writeAuditStub } from "@/lib/audit";
import { db } from "@/lib/store";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const limit = Math.min(Math.max(Number(searchParams.get("limit") || 10), 1), 50);

  const start = cursor ? db.posts.findIndex((item) => item.id === cursor) + 1 : 0;
  const rows = db.posts.slice(Math.max(start, 0), Math.max(start, 0) + limit);
  const nextCursor = rows.length === limit ? rows[rows.length - 1]?.id ?? null : null;

  const session = await auth();
  const actorId = session?.user?.id ?? "anonymous";

  await writeAuditStub({
    actorId,
    action: "feed.requested",
    targetType: "feed",
    metadata: {
      cursor,
      limit,
      resultCount: rows.length,
      authenticated: !!session?.user
    },
    createdAt: new Date().toISOString()
  });

  return NextResponse.json({
    data: rows,
    pageInfo: {
      nextCursor,
      limit
    }
  });
}
