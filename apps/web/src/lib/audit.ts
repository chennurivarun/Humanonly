export type AuditAction =
  | "auth.signed_in"
  | "auth.signed_out"
  | "auth.session.denied"
  | "post.created"
  | "feed.requested"
  | "report.created"
  | "reports.queue.requested"
  | "moderation.override.applied";

export type AuditTargetType = "identity" | "authorization" | "post" | "feed" | "report" | "moderation_queue";

export type AuditRecord = {
  actorId: string;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export async function writeAuditStub(record: AuditRecord): Promise<void> {
  // TODO: Replace with immutable persistence backend (Sprint 2)
  console.info("[audit-stub]", JSON.stringify(record));
}
