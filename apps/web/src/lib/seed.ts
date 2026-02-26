import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const SUPPORTED_SEED_VERSION = 1;
const REPORT_STATUSES = new Set(["open", "triaged", "resolved"] as const);

type ReportStatus = "open" | "triaged" | "resolved";
type HumanRole = "member" | "moderator" | "admin";

export type SeedIdentity = {
  id: string;
  handle: string;
  displayName: string;
  role: HumanRole;
  governanceAcceptedAt: string;
  humanVerifiedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type SeedPost = {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
};

export type SeedReport = {
  id: string;
  postId: string;
  reporterId: string;
  reason: string;
  status: ReportStatus;
  createdAt: string;
};

export type SeedSnapshot = {
  version: typeof SUPPORTED_SEED_VERSION;
  generatedAt: string;
  governance: {
    humanExpressionOnly: true;
    aiManagedOperationsOnly: true;
    humanGovernedDecisionsOnly: true;
    auditabilityRequired: true;
    humanOverrideReservedForAdmins: true;
  };
  users: SeedIdentity[];
  posts: SeedPost[];
  reports: SeedReport[];
};

export type SeedableStore = {
  users: SeedIdentity[];
  posts: SeedPost[];
  reports: SeedReport[];
};

export type SeedApplySummary = {
  users: number;
  posts: number;
  reports: number;
};

export class SeedValidationError extends Error {
  readonly code:
    | "INVALID_JSON"
    | "INVALID_VERSION"
    | "USERS_REQUIRED"
    | "POSTS_REQUIRED"
    | "REPORTS_REQUIRED"
    | "DUPLICATE_USER_ID"
    | "DUPLICATE_USER_HANDLE"
    | "UNKNOWN_POST_AUTHOR"
    | "UNKNOWN_REPORT_POST"
    | "UNKNOWN_REPORTER"
    | "INVALID_REPORT_STATUS"
    | "INVALID_GOVERNANCE_ASSERTION";

  constructor(code: SeedValidationError["code"], message: string) {
    super(message);
    this.name = "SeedValidationError";
    this.code = code;
  }
}

function expectIso(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new SeedValidationError("INVALID_JSON", `${fieldName} must be an ISO timestamp`);
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    throw new SeedValidationError("INVALID_JSON", `${fieldName} must be a valid ISO timestamp`);
  }

  return new Date(parsed).toISOString();
}

function expectNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new SeedValidationError("INVALID_JSON", `${fieldName} must be a non-empty string`);
  }

  return value.trim();
}

function expectRole(value: unknown, fieldName: string): HumanRole {
  if (value === "member" || value === "moderator" || value === "admin") {
    return value;
  }

  throw new SeedValidationError("INVALID_JSON", `${fieldName} must be member, moderator, or admin`);
}

function expectReportStatus(value: unknown): ReportStatus {
  if (value === "open" || value === "triaged" || value === "resolved") {
    return value;
  }

  throw new SeedValidationError("INVALID_REPORT_STATUS", "report status must be open, triaged, or resolved");
}

function createTimestampFactory(referenceIso: string) {
  const reference = new Date(referenceIso);

  return (offsetMinutes: number): string => {
    const shifted = new Date(reference.getTime() + offsetMinutes * 60 * 1000);
    return shifted.toISOString();
  };
}

export function createDefaultSeedSnapshot(referenceIso = new Date().toISOString()): SeedSnapshot {
  const nowIso = expectIso(referenceIso, "referenceIso");
  const stamp = createTimestampFactory(nowIso);

  const users: SeedIdentity[] = [
    {
      id: "usr_chief_admin",
      handle: "chief_admin",
      displayName: "Chief Admin",
      role: "admin",
      governanceAcceptedAt: stamp(-90),
      humanVerifiedAt: stamp(-90),
      createdAt: stamp(-90),
      updatedAt: stamp(-90)
    },
    {
      id: "usr_queue_mod",
      handle: "queue_mod",
      displayName: "Queue Moderator",
      role: "moderator",
      governanceAcceptedAt: stamp(-80),
      humanVerifiedAt: stamp(-80),
      createdAt: stamp(-80),
      updatedAt: stamp(-80)
    },
    {
      id: "usr_human_author",
      handle: "human_author",
      displayName: "Human Author",
      role: "member",
      governanceAcceptedAt: stamp(-75),
      humanVerifiedAt: stamp(-75),
      createdAt: stamp(-75),
      updatedAt: stamp(-75)
    },
    {
      id: "usr_civic_reader",
      handle: "civic_reader",
      displayName: "Civic Reader",
      role: "member",
      governanceAcceptedAt: stamp(-70),
      humanVerifiedAt: stamp(-70),
      createdAt: stamp(-70),
      updatedAt: stamp(-70)
    }
  ];

  const posts: SeedPost[] = [
    {
      id: "pst_human_manifesto",
      authorId: "usr_human_author",
      body: "HumanOnly is built for real people. AI can assist ops, but expression stays human.",
      createdAt: stamp(-55)
    },
    {
      id: "pst_queue_transparency",
      authorId: "usr_civic_reader",
      body: "Moderation queues should be transparent, appealable, and auditable.",
      createdAt: stamp(-45)
    },
    {
      id: "pst_override_policy",
      authorId: "usr_chief_admin",
      body: "Emergency override exists for admins, with explicit human confirmation and audit logs.",
      createdAt: stamp(-35)
    }
  ];

  const reports: SeedReport[] = [
    {
      id: "rpt_open_sample",
      postId: "pst_human_manifesto",
      reporterId: "usr_civic_reader",
      reason: "Sample open report to validate moderation queue behavior.",
      status: "open",
      createdAt: stamp(-25)
    },
    {
      id: "rpt_triaged_sample",
      postId: "pst_queue_transparency",
      reporterId: "usr_queue_mod",
      reason: "Sample triaged report to test admin override transitions.",
      status: "triaged",
      createdAt: stamp(-20)
    },
    {
      id: "rpt_resolved_sample",
      postId: "pst_override_policy",
      reporterId: "usr_chief_admin",
      reason: "Sample resolved report for audit trail verification.",
      status: "resolved",
      createdAt: stamp(-15)
    }
  ];

  return {
    version: SUPPORTED_SEED_VERSION,
    generatedAt: nowIso,
    governance: {
      humanExpressionOnly: true,
      aiManagedOperationsOnly: true,
      humanGovernedDecisionsOnly: true,
      auditabilityRequired: true,
      humanOverrideReservedForAdmins: true
    },
    users,
    posts,
    reports
  };
}

function cloneSnapshot(snapshot: SeedSnapshot): SeedSnapshot {
  return {
    ...snapshot,
    governance: { ...snapshot.governance },
    users: snapshot.users.map((user) => ({ ...user })),
    posts: snapshot.posts.map((post) => ({ ...post })),
    reports: snapshot.reports.map((report) => ({ ...report }))
  };
}

export function parseSeedSnapshot(payload: unknown): SeedSnapshot {
  if (!payload || typeof payload !== "object") {
    throw new SeedValidationError("INVALID_JSON", "Seed payload must be a JSON object");
  }

  const body = payload as Record<string, unknown>;

  if (body.version !== SUPPORTED_SEED_VERSION) {
    throw new SeedValidationError("INVALID_VERSION", `Seed version must be ${SUPPORTED_SEED_VERSION}`);
  }

  if (!body.governance || typeof body.governance !== "object") {
    throw new SeedValidationError("INVALID_GOVERNANCE_ASSERTION", "governance assertions are required");
  }

  const governance = body.governance as Record<string, unknown>;
  const governanceKeys = [
    "humanExpressionOnly",
    "aiManagedOperationsOnly",
    "humanGovernedDecisionsOnly",
    "auditabilityRequired",
    "humanOverrideReservedForAdmins"
  ] as const;

  for (const key of governanceKeys) {
    if (governance[key] !== true) {
      throw new SeedValidationError("INVALID_GOVERNANCE_ASSERTION", `${key}=true is required`);
    }
  }

  if (!Array.isArray(body.users)) {
    throw new SeedValidationError("USERS_REQUIRED", "users array is required");
  }

  if (!Array.isArray(body.posts)) {
    throw new SeedValidationError("POSTS_REQUIRED", "posts array is required");
  }

  if (!Array.isArray(body.reports)) {
    throw new SeedValidationError("REPORTS_REQUIRED", "reports array is required");
  }

  const users = body.users.map((rawUser, index): SeedIdentity => {
    if (!rawUser || typeof rawUser !== "object") {
      throw new SeedValidationError("INVALID_JSON", `users[${index}] must be an object`);
    }

    const user = rawUser as Record<string, unknown>;

    return {
      id: expectNonEmptyString(user.id, `users[${index}].id`),
      handle: expectNonEmptyString(user.handle, `users[${index}].handle`).toLowerCase(),
      displayName: expectNonEmptyString(user.displayName, `users[${index}].displayName`),
      role: expectRole(user.role, `users[${index}].role`),
      governanceAcceptedAt: expectIso(user.governanceAcceptedAt, `users[${index}].governanceAcceptedAt`),
      humanVerifiedAt: expectIso(user.humanVerifiedAt, `users[${index}].humanVerifiedAt`),
      createdAt: expectIso(user.createdAt, `users[${index}].createdAt`),
      updatedAt: expectIso(user.updatedAt, `users[${index}].updatedAt`)
    };
  });

  const posts = body.posts.map((rawPost, index): SeedPost => {
    if (!rawPost || typeof rawPost !== "object") {
      throw new SeedValidationError("INVALID_JSON", `posts[${index}] must be an object`);
    }

    const post = rawPost as Record<string, unknown>;

    return {
      id: expectNonEmptyString(post.id, `posts[${index}].id`),
      authorId: expectNonEmptyString(post.authorId, `posts[${index}].authorId`),
      body: expectNonEmptyString(post.body, `posts[${index}].body`),
      createdAt: expectIso(post.createdAt, `posts[${index}].createdAt`)
    };
  });

  const reports = body.reports.map((rawReport, index): SeedReport => {
    if (!rawReport || typeof rawReport !== "object") {
      throw new SeedValidationError("INVALID_JSON", `reports[${index}] must be an object`);
    }

    const report = rawReport as Record<string, unknown>;

    return {
      id: expectNonEmptyString(report.id, `reports[${index}].id`),
      postId: expectNonEmptyString(report.postId, `reports[${index}].postId`),
      reporterId: expectNonEmptyString(report.reporterId, `reports[${index}].reporterId`),
      reason: expectNonEmptyString(report.reason, `reports[${index}].reason`),
      status: expectReportStatus(report.status),
      createdAt: expectIso(report.createdAt, `reports[${index}].createdAt`)
    };
  });

  const userIds = new Set<string>();
  const handles = new Set<string>();

  for (const user of users) {
    if (userIds.has(user.id)) {
      throw new SeedValidationError("DUPLICATE_USER_ID", `duplicate user id: ${user.id}`);
    }
    userIds.add(user.id);

    if (handles.has(user.handle)) {
      throw new SeedValidationError("DUPLICATE_USER_HANDLE", `duplicate user handle: ${user.handle}`);
    }
    handles.add(user.handle);
  }

  const postIds = new Set<string>();
  for (const post of posts) {
    if (!userIds.has(post.authorId)) {
      throw new SeedValidationError("UNKNOWN_POST_AUTHOR", `post ${post.id} references unknown author ${post.authorId}`);
    }

    postIds.add(post.id);
  }

  for (const report of reports) {
    if (!REPORT_STATUSES.has(report.status)) {
      throw new SeedValidationError("INVALID_REPORT_STATUS", `invalid report status: ${report.status}`);
    }

    if (!postIds.has(report.postId)) {
      throw new SeedValidationError("UNKNOWN_REPORT_POST", `report ${report.id} references unknown post ${report.postId}`);
    }

    if (!userIds.has(report.reporterId)) {
      throw new SeedValidationError("UNKNOWN_REPORTER", `report ${report.id} references unknown reporter ${report.reporterId}`);
    }
  }

  return {
    version: SUPPORTED_SEED_VERSION,
    generatedAt: expectIso(body.generatedAt, "generatedAt"),
    governance: {
      humanExpressionOnly: true,
      aiManagedOperationsOnly: true,
      humanGovernedDecisionsOnly: true,
      auditabilityRequired: true,
      humanOverrideReservedForAdmins: true
    },
    users,
    posts,
    reports
  };
}

export function applySeedSnapshot(store: SeedableStore, snapshot: SeedSnapshot): SeedApplySummary {
  const parsed = parseSeedSnapshot(snapshot);

  store.users.splice(0, store.users.length, ...parsed.users.map((user) => ({ ...user })));
  store.posts.splice(0, store.posts.length, ...parsed.posts.map((post) => ({ ...post })));
  store.reports.splice(0, store.reports.length, ...parsed.reports.map((report) => ({ ...report })));

  return {
    users: parsed.users.length,
    posts: parsed.posts.length,
    reports: parsed.reports.length
  };
}

export function resolveSeedPath(seedPath: string): string {
  return path.isAbsolute(seedPath) ? seedPath : path.resolve(process.cwd(), seedPath);
}

export function loadSeedSnapshotFromFile(seedPath: string): SeedSnapshot {
  const resolvedPath = resolveSeedPath(seedPath);

  if (!existsSync(resolvedPath)) {
    throw new SeedValidationError("INVALID_JSON", `Seed file not found at ${resolvedPath}`);
  }

  const raw = readFileSync(resolvedPath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  return parseSeedSnapshot(parsed);
}

export function seedStoreFromFile(store: SeedableStore, seedPath: string): SeedApplySummary {
  const snapshot = loadSeedSnapshotFromFile(seedPath);
  return applySeedSnapshot(store, snapshot);
}

export function writeSeedSnapshotToFile(snapshot: SeedSnapshot, seedPath: string): string {
  const parsed = parseSeedSnapshot(snapshot);
  const resolvedPath = resolveSeedPath(seedPath);

  mkdirSync(path.dirname(resolvedPath), { recursive: true });
  writeFileSync(resolvedPath, `${JSON.stringify(cloneSnapshot(parsed), null, 2)}\n`, "utf8");

  return resolvedPath;
}
