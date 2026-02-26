import { seedStoreFromFile, SeedValidationError } from "@/lib/seed";

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

const posts: Post[] = [];
const reports: Report[] = [];
const users: IdentityProfile[] = [];

function findUserByHandle(handle: string): IdentityProfile | undefined {
  return users.find((user) => user.handle === handle);
}

export function upsertIdentity(identity: Omit<IdentityProfile, "createdAt" | "updatedAt"> & Partial<Pick<IdentityProfile, "createdAt" | "updatedAt">>): IdentityProfile {
  const now = new Date().toISOString();
  const existing = findUserByHandle(identity.handle);

  if (existing) {
    existing.displayName = identity.displayName;
    existing.role = identity.role;
    existing.humanVerifiedAt = identity.humanVerifiedAt;
    existing.governanceAcceptedAt = identity.governanceAcceptedAt;
    existing.updatedAt = now;
    return existing;
  }

  const created: IdentityProfile = {
    ...identity,
    createdAt: identity.createdAt ?? now,
    updatedAt: identity.updatedAt ?? now
  };

  users.unshift(created);
  return created;
}

export const db = {
  posts,
  reports,
  users
};

function loadSeedDataIfConfigured() {
  const seedFile = process.env.HUMANONLY_SEED_FILE?.trim();
  if (!seedFile) {
    return;
  }

  try {
    const summary = seedStoreFromFile(db, seedFile);
    console.info(`[seed] loaded ${summary.users} users, ${summary.posts} posts, ${summary.reports} reports from ${seedFile}`);
  } catch (error) {
    if (error instanceof SeedValidationError) {
      throw new Error(`Failed to load HUMANONLY_SEED_FILE: ${error.message}`);
    }

    throw error;
  }
}

loadSeedDataIfConfigured();
