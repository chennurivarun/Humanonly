import {
  applySeedSnapshot,
  seedStoreFromFile,
  type SeedApplySummary,
  type SeedSnapshot,
  writeSeedSnapshotToFile
} from "@/lib/seed";
import type { IdentityProfile, Post, Report } from "@/lib/store";

export const GOVERNANCE_ASSERTIONS = {
  humanExpressionOnly: true,
  aiManagedOperationsOnly: true,
  humanGovernedDecisionsOnly: true,
  auditabilityRequired: true,
  humanOverrideReservedForAdmins: true
} as const;

export type GovernedStore = {
  users: IdentityProfile[];
  posts: Post[];
  reports: Report[];
};

function cloneStoreRows<T>(rows: T[]): T[] {
  return rows.map((row) => ({ ...row }));
}

export function createGovernedSnapshot(
  store: GovernedStore,
  generatedAt = new Date().toISOString()
): SeedSnapshot {
  return {
    version: 1,
    generatedAt,
    governance: {
      ...GOVERNANCE_ASSERTIONS
    },
    users: cloneStoreRows(store.users),
    posts: cloneStoreRows(store.posts),
    reports: cloneStoreRows(store.reports)
  };
}

export function hydrateGovernedStoreFromFile(store: GovernedStore, seedPath: string): SeedApplySummary {
  return seedStoreFromFile(store, seedPath);
}

export function hydrateGovernedStoreFromSnapshot(
  store: GovernedStore,
  snapshot: SeedSnapshot
): SeedApplySummary {
  return applySeedSnapshot(store, snapshot);
}

export function persistGovernedStoreToFile(
  store: GovernedStore,
  filePath: string,
  generatedAt = new Date().toISOString()
): string {
  const snapshot = createGovernedSnapshot(store, generatedAt);
  return writeSeedSnapshotToFile(snapshot, filePath);
}
