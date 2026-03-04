import { createHash } from "node:crypto";
import type { GovernedStore } from "@/lib/governed-store";

export type StoreEntityCounts = {
  users: number;
  posts: number;
  reports: number;
  appeals: number;
};

export type StoreIntegrityViolation = {
  entity: "posts" | "reports" | "appeals";
  id: string;
  relation: "authorId" | "postId" | "reporterId" | "reportId" | "appellantId";
  missingId: string;
};

export type CutoverParity = {
  sourceCounts: StoreEntityCounts;
  targetCounts: StoreEntityCounts;
  countsMatch: boolean;
  sourceFingerprint: string;
  targetFingerprint: string;
  fingerprintMatch: boolean;
};

function normalizeStoreForFingerprint(store: GovernedStore): GovernedStore {
  const byId = <T extends { id: string }>(rows: T[]) => [...rows].sort((a, b) => a.id.localeCompare(b.id));

  return {
    users: byId(store.users).map((user) => ({
      ...user,
      identityAssuranceSignals: user.identityAssuranceSignals
        ? [...user.identityAssuranceSignals].sort()
        : undefined
    })),
    posts: byId(store.posts),
    reports: byId(store.reports),
    appeals: byId(store.appeals)
  };
}

export function countStoreEntities(store: GovernedStore): StoreEntityCounts {
  return {
    users: store.users.length,
    posts: store.posts.length,
    reports: store.reports.length,
    appeals: store.appeals.length
  };
}

export function storeFingerprint(store: GovernedStore): string {
  const normalized = normalizeStoreForFingerprint(store);
  const payload = JSON.stringify(normalized);
  return createHash("sha256").update(payload).digest("hex");
}

export function collectStoreIntegrityViolations(store: GovernedStore): StoreIntegrityViolation[] {
  const violations: StoreIntegrityViolation[] = [];

  const userIds = new Set(store.users.map((row) => row.id));
  const postIds = new Set(store.posts.map((row) => row.id));
  const reportIds = new Set(store.reports.map((row) => row.id));

  for (const post of store.posts) {
    if (!userIds.has(post.authorId)) {
      violations.push({
        entity: "posts",
        id: post.id,
        relation: "authorId",
        missingId: post.authorId
      });
    }
  }

  for (const report of store.reports) {
    if (!postIds.has(report.postId)) {
      violations.push({
        entity: "reports",
        id: report.id,
        relation: "postId",
        missingId: report.postId
      });
    }

    if (!userIds.has(report.reporterId)) {
      violations.push({
        entity: "reports",
        id: report.id,
        relation: "reporterId",
        missingId: report.reporterId
      });
    }
  }

  for (const appeal of store.appeals) {
    if (!reportIds.has(appeal.reportId)) {
      violations.push({
        entity: "appeals",
        id: appeal.id,
        relation: "reportId",
        missingId: appeal.reportId
      });
    }

    if (!userIds.has(appeal.appellantId)) {
      violations.push({
        entity: "appeals",
        id: appeal.id,
        relation: "appellantId",
        missingId: appeal.appellantId
      });
    }
  }

  return violations;
}

export function evaluateCutoverParity(source: GovernedStore, target: GovernedStore): CutoverParity {
  const sourceCounts = countStoreEntities(source);
  const targetCounts = countStoreEntities(target);

  const sourceFingerprint = storeFingerprint(source);
  const targetFingerprint = storeFingerprint(target);

  return {
    sourceCounts,
    targetCounts,
    countsMatch:
      sourceCounts.users === targetCounts.users &&
      sourceCounts.posts === targetCounts.posts &&
      sourceCounts.reports === targetCounts.reports &&
      sourceCounts.appeals === targetCounts.appeals,
    sourceFingerprint,
    targetFingerprint,
    fingerprintMatch: sourceFingerprint === targetFingerprint
  };
}
