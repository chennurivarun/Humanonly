import {
  hydrateGovernedStoreFromFile,
  type GovernedStore
} from "@/lib/governed-store";
import { resolveSeedPath, SeedValidationError } from "@/lib/seed";
import { createStorageAdapter, type StorageAdapter } from "@/lib/storage";
import type { IdentityAssuranceLevel, IdentityAssuranceSignal } from "@/lib/auth/assurance";

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
  identityAssuranceLevel?: IdentityAssuranceLevel;
  identityAssuranceSignals?: IdentityAssuranceSignal[];
  identityAssuranceEvaluatedAt?: string;
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

// Active storage adapter — selected and initialized at startup.
// Exported so reliability checks can call healthCheck() without re-reading env.
export let adapter: StorageAdapter;

/**
 * Persist the current in-memory store to durable storage.
 *
 * For SQLite and JSON-file adapters the flush is synchronous under the hood
 * so no data is at risk. For Postgres the flush is asynchronous; the Promise
 * is intentionally fire-and-forgotten here so callers remain synchronous.
 * The only exposure is a process crash between response and flush completion,
 * which is acceptable for the current single-writer topology.
 */
export function persistStore(): void {
  void adapter.flush(db);
}

function hydrateDomainArrays(loaded: GovernedStore): void {
  users.splice(0, users.length, ...loaded.users);
  posts.splice(0, posts.length, ...loaded.posts);
  reports.splice(0, reports.length, ...loaded.reports);
  appeals.splice(0, appeals.length, ...loaded.appeals);
}

function findUserByHandle(handle: string): IdentityProfile | undefined {
  return users.find((user) => user.handle === handle);
}

export function upsertIdentity(
  identity: Omit<IdentityProfile, "createdAt" | "updatedAt"> &
    Partial<Pick<IdentityProfile, "createdAt" | "updatedAt">>
): IdentityProfile {
  const now = new Date().toISOString();
  const existing = findUserByHandle(identity.handle);

  if (existing) {
    existing.displayName = identity.displayName;
    existing.role = identity.role;
    existing.humanVerifiedAt = identity.humanVerifiedAt;
    existing.governanceAcceptedAt = identity.governanceAcceptedAt;
    existing.identityAssuranceLevel = identity.identityAssuranceLevel;
    existing.identityAssuranceSignals = identity.identityAssuranceSignals;
    existing.identityAssuranceEvaluatedAt = identity.identityAssuranceEvaluatedAt;
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

// ── Bootstrap helpers ─────────────────────────────────────────────────────────

/**
 * Attempt to bootstrap from a JSON seed/snapshot file.
 * Returns true when data was loaded.
 */
function bootstrapFromJsonFile(filePath: string, label: string): boolean {
  const tempStore: GovernedStore = { users: [], posts: [], reports: [], appeals: [] };

  try {
    const summary = hydrateGovernedStoreFromFile(tempStore, filePath);
    hydrateDomainArrays(tempStore);
    persistStore();
    console.info(
      `[store] bootstrapped from ${label} (${summary.users} users, ${summary.posts} posts, ` +
        `${summary.reports} reports, ${summary.appeals} appeals)`
    );
    return true;
  } catch (error) {
    if (error instanceof SeedValidationError) {
      throw new Error(`Failed to load ${label}: ${error.message}`);
    }
    throw error;
  }
}

async function initializeStore(): Promise<void> {
  adapter = createStorageAdapter();
  await adapter.initialize();

  const loaded = await adapter.loadAll();

  if (loaded.users.length > 0 || loaded.posts.length > 0) {
    // Existing data in storage — hydrate in-memory arrays from it.
    hydrateDomainArrays(loaded);
    console.info(
      `[store] loaded from ${process.env.HUMANONLY_STORAGE_BACKEND ?? "sqlite"} ` +
        `(${loaded.users.length} users, ${loaded.posts.length} posts, ` +
        `${loaded.reports.length} reports, ${loaded.appeals.length} appeals)`
    );
    return;
  }

  // Storage is empty — try seed or legacy JSON bootstrap paths.

  const seedFile = process.env.HUMANONLY_SEED_FILE?.trim();
  if (seedFile) {
    const resolved = resolveSeedPath(seedFile);
    bootstrapFromJsonFile(resolved, `HUMANONLY_SEED_FILE (${resolved})`);
    return;
  }

  // Compat path: if a legacy HUMANONLY_DATA_FILE JSON snapshot exists, migrate
  // it into the current storage backend on first run.
  const dataFile = process.env.HUMANONLY_DATA_FILE?.trim();
  if (dataFile) {
    const resolved = resolveSeedPath(dataFile);
    try {
      const bootstrapped = bootstrapFromJsonFile(resolved, `HUMANONLY_DATA_FILE (${resolved})`);
      if (bootstrapped) {
        console.info("[store] migrated legacy JSON snapshot into current storage backend");
      }
    } catch {
      // Non-fatal: file may not exist yet
    }
  }
}

void initializeStore().catch((err) => {
  console.error("[store] fatal: failed to initialize storage", err);
  process.exit(1);
});
