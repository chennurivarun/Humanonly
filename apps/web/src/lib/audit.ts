export type AuditAction =
  | "post.created"
  | "feed.requested"
  | "report.created"
  | "reports.queue.requested";

export type AuditRecord = {
  actorId: string;
  action: AuditAction;
  targetType: "post" | "feed" | "report" | "moderation_queue";
  targetId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export async function writeAuditStub(record: AuditRecord): Promise<void> {
  // TODO: Replace with immutable persistence backend (Sprint 2)
  console.info("[audit-stub]", JSON.stringify(record));
}
