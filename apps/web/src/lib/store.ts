import { existsSync } from "node:fs";
import {
  hydrateGovernedStoreFromFile,
  persistGovernedStoreToFile,
  type GovernedStore
} from "@/lib/governed-store";
import { resolveSeedPath, SeedValidationError } from "@/lib/seed";

export type HumanRole = "member" | "moderator" | "admin";

export type IdentityProfile = {
  id: string;
  handle: string;
  displayName: string;
  role: HumanRole;
  governanceAcceptedAt: string;
  humanVerifiedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type Post = {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
};

export type Report = {
  id: string;
  postId: string;
  reporterId: string;
  reason: string;
  status: "open" | "triaged" | "resolved";
  createdAt: string;
};

export type Appeal = {
  id: string;
  reportId: string;
  appellantId: string;
  reason: string;
  status: "open" | "under_review" | "upheld" | "granted";
  appealedAuditRecordId?: string;
  createdAt: string;
  updatedAt: string;
  decidedAt?: string;
  decidedById?: string;
  decisionRationale?: string;
};

const posts: Post[] = [];
const reports: Report[] = [];
const appeals: Appeal[] = [];
const users: IdentityProfile[] = [];

export const db: GovernedStore = {
  posts,
  reports,
  appeals,
  users
};

const DEFAULT_DURABLE_STORE_FILE = ".data/store.json";

function configuredStoreFilePath(): string {
  return process.env.HUMANONLY_DATA_FILE?.trim() || DEFAULT_DURABLE_STORE_FILE;
}

export function resolveDurableStoreFilePath(): string {
  return resolveSeedPath(configuredStoreFilePath());
}

export function persistStore(nowIso = new Date().toISOString()): string {
  return persistGovernedStoreToFile(db, configuredStoreFilePath(), nowIso);
}

function findUserByHandle(handle: string): IdentityProfile | undefined {
  return users.find((user) => user.handle === handle);
}

export function upsertIdentity(
  identity: Omit<IdentityProfile, "createdAt" | "updatedAt"> & Partial<Pick<IdentityProfile, "createdAt" | "updatedAt">>
): IdentityProfile {
  const now = new Date().toISOString();
  const existing = findUserByHandle(identity.handle);

  if (existing) {
    existing.displayName = identity.displayName;
    existing.role = identity.role;
    existing.humanVerifiedAt = identity.humanVerifiedAt;
    existing.governanceAcceptedAt = identity.governanceAcceptedAt;
    existing.updatedAt = now;
    persistStore();
    return existing;
  }

  const created: IdentityProfile = {
    ...identity,
    createdAt: identity.createdAt ?? now,
    updatedAt: identity.updatedAt ?? now
  };

  users.unshift(created);
  persistStore();
  return created;
}

function loadDurableStoreIfPresent(): boolean {
  const resolvedStorePath = resolveDurableStoreFilePath();
  if (!existsSync(resolvedStorePath)) {
    return false;
  }

  try {
    const summary = hydrateGovernedStoreFromFile(db, configuredStoreFilePath());
    console.info(
      `[store] loaded durable snapshot (${summary.users} users, ${summary.posts} posts, ${summary.reports} reports, ${summary.appeals} appeals) from ${resolvedStorePath}`
    );
    return true;
  } catch (error) {
    if (error instanceof SeedValidationError) {
      throw new Error(`Failed to load HUMANONLY_DATA_FILE: ${error.message}`);
    }

    throw error;
  }
}

function loadSeedDataIfConfigured(): boolean {
  const seedFile = process.env.HUMANONLY_SEED_FILE?.trim();
  if (!seedFile) {
    return false;
  }

  try {
    const summary = hydrateGovernedStoreFromFile(db, seedFile);
    console.info(
      `[seed] loaded ${summary.users} users, ${summary.posts} posts, ${summary.reports} reports, ${summary.appeals} appeals from ${seedFile}`
    );
    persistStore();
    return true;
  } catch (error) {
    if (error instanceof SeedValidationError) {
      throw new Error(`Failed to load HUMANONLY_SEED_FILE: ${error.message}`);
    }

    throw error;
  }
}

function initializeStore() {
  if (loadDurableStoreIfPresent()) {
    return;
  }

  loadSeedDataIfConfigured();
}

initializeStore();
