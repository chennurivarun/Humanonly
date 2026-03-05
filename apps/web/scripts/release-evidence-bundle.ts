import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  redactManagedEndpointUrl,
  renderReleaseGovernanceEvidenceMarkdown,
  type CutoverEvidenceReport,
  type ManagedValidationEvidenceReport,
  type ReleaseGovernanceEvidenceBundle,
  type ReleaseEvidenceSignOffs,
  type SignOffStatus
} from "@/lib/release-governance-evidence";

type TargetProfile = "managed" | "ephemeral" | "unknown";

const DEFAULT_OUTPUT_PATH = "docs/SPRINT_7_RELEASE_EVIDENCE_BUNDLE.md";
const DEFAULT_OUTPUT_JSON_PATH = "docs/SPRINT_7_RELEASE_EVIDENCE_BUNDLE.json";

function parseArg(flag: string): string | undefined {
  const idx = process.argv.findIndex((token) => token === flag || token.startsWith(`${flag}=`));
  if (idx === -1) return undefined;

  const token = process.argv[idx];
  if (token?.includes("=")) {
    return token.split("=").slice(1).join("=");
  }

  const next = process.argv[idx + 1];
  return next && !next.startsWith("--") ? next : undefined;
}

function parseMultiArg(flag: string): string[] {
  const values: string[] = [];
  for (let idx = 0; idx < process.argv.length; idx += 1) {
    const token = process.argv[idx];
    if (!token) continue;

    if (token === flag) {
      const next = process.argv[idx + 1];
      if (next && !next.startsWith("--")) {
        values.push(next);
      }
      continue;
    }

    if (token.startsWith(`${flag}=`)) {
      values.push(token.split("=").slice(1).join("="));
    }
  }

  return values;
}

function usage(): string {
  return [
    "Usage:",
    "  npm run release:evidence:bundle -w apps/web -- \\",
    "    --cutover-plan-json=.tmp/release-cadence/cutover-plan.json \\",
    "    --cutover-apply-json=.tmp/release-cadence/cutover-apply.json \\",
    "    --cutover-verify-json=.tmp/release-cadence/cutover-verify.json \\",
    "    --perf-json=.tmp/release-cadence/perf-postgres-managed.json \\",
    "    --run-id=<github-run-id> \\",
    "    --run-url=<https://github.com/.../actions/runs/...> \\",
    "    --approval-ref=CHANGE-123",
    "",
    "Optional:",
    `  --output=${DEFAULT_OUTPUT_PATH}`,
    `  --output-json=${DEFAULT_OUTPUT_JSON_PATH}`,
    "  --target-profile=managed|ephemeral|unknown",
    "  --managed-postgres-url=postgres://user:***@host:5432/db",
    "  --managed-postgres-source=repo-secret|workflow-input|env|ephemeral-default|unknown",
    "  --release-manager=<name>",
    "  --incident-commander=<name>",
    "  --platform-operator=<name>",
    "  --governance-lead=<name>",
    "  --release-manager-signoff=pending|approved|rejected",
    "  --release-manager-signoff-ref=CHANGE-123",
    "  --release-manager-signoff-at=2026-03-05T07:30:00Z",
    "  --release-manager-signoff-notes='Approved after rollback validation'",
    "  (same signoff flags for incident-commander/platform-operator/governance-lead)",
    "  --artifact-link=\"Cutover plan|.tmp/release-cadence/cutover-plan.json|https://...\"",
    "  --risk=\"Managed endpoint maintenance overlaps cadence\"",
    "  --next-action=\"Attach evidence links in release ticket\""
  ].join("\n");
}

function parseTargetProfile(raw: string | undefined): TargetProfile {
  const normalized = raw?.trim().toLowerCase();
  if (normalized === "managed" || normalized === "ephemeral" || normalized === "unknown") {
    return normalized;
  }
  return "unknown";
}

function resolveInputPath(path: string): string {
  const cwdResolved = resolve(process.cwd(), path);
  if (existsSync(cwdResolved)) {
    return cwdResolved;
  }

  const repoRootResolved = resolve(process.cwd(), "..", "..", path);
  if (existsSync(repoRootResolved)) {
    return repoRootResolved;
  }

  return cwdResolved;
}

function resolveOutputPath(path: string): string {
  if (path.startsWith("/")) {
    return path;
  }

  return resolve(process.cwd(), "..", "..", path);
}

function parseJsonFile<T>(path: string): T {
  const absolute = resolveInputPath(path);
  const content = readFileSync(absolute, "utf8");
  return JSON.parse(content) as T;
}

function requiredArg(flag: string): string {
  const value = parseArg(flag)?.trim();
  if (!value) {
    throw new Error(`missing required argument: ${flag}`);
  }
  return value;
}

function parseArtifactLinks(links: string[]) {
  return links
    .map((link) => link.trim())
    .filter((link) => link.length > 0)
    .map((link) => {
      const [label, path, url] = link.split("|").map((item) => item?.trim() ?? "");
      if (!label || !path) {
        throw new Error(`invalid --artifact-link value: ${link}`);
      }
      return {
        label,
        path,
        url: url || undefined
      };
    });
}

function parseSignOffStatus(raw: string | undefined): SignOffStatus | undefined {
  const normalized = raw?.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === "pending" || normalized === "approved" || normalized === "rejected") {
    return normalized;
  }
  throw new Error(`invalid signoff status: ${raw}`);
}

type RoleFlagPrefix =
  | "release-manager"
  | "incident-commander"
  | "platform-operator"
  | "governance-lead";

function parseRoleSignOff(prefix: RoleFlagPrefix): ReleaseEvidenceSignOffs[keyof ReleaseEvidenceSignOffs] {
  const status = parseSignOffStatus(parseArg(`--${prefix}-signoff`));
  const approvalRef = parseArg(`--${prefix}-signoff-ref`)?.trim();
  const signedAt = parseArg(`--${prefix}-signoff-at`)?.trim();
  const notes = parseArg(`--${prefix}-signoff-notes`)?.trim();

  if (!status && !approvalRef && !signedAt && !notes) {
    return undefined;
  }

  if (!status) {
    throw new Error(`--${prefix}-signoff is required when signoff metadata is provided`);
  }

  if (status !== "pending" && (!approvalRef || !signedAt)) {
    throw new Error(`--${prefix}-signoff-ref and --${prefix}-signoff-at are required for ${status} signoff`);
  }

  return {
    status,
    approvalRef,
    signedAt,
    notes
  };
}

function main() {
  const outputPath = parseArg("--output") ?? DEFAULT_OUTPUT_PATH;
  const outputJsonPath = parseArg("--output-json") ?? DEFAULT_OUTPUT_JSON_PATH;
  const runId = requiredArg("--run-id");
  const runUrl = requiredArg("--run-url");

  const plan = parseJsonFile<CutoverEvidenceReport>(requiredArg("--cutover-plan-json"));
  const apply = parseJsonFile<CutoverEvidenceReport>(requiredArg("--cutover-apply-json"));
  const verify = parseJsonFile<CutoverEvidenceReport>(requiredArg("--cutover-verify-json"));
  const perfRaw = parseJsonFile<{ [key: string]: unknown }>(requiredArg("--perf-json"));

  const managedValidation: ManagedValidationEvidenceReport = {
    generatedAt: String(perfRaw.generatedAt ?? new Date().toISOString()),
    humanApprovalRef: String(perfRaw.humanApprovalRef ?? parseArg("--approval-ref") ?? "UNKNOWN"),
    simulatedNetworkLatencyMs: Number(perfRaw.simulatedNetworkLatencyMs ?? 0),
    postgresSource: (perfRaw.postgresSource as ManagedValidationEvidenceReport["postgresSource"]) ??
      "embedded",
    incremental: {
      averageDurationMs: Number((perfRaw.incremental as { averageDurationMs?: number })?.averageDurationMs ?? 0),
      p95DurationMs: Number((perfRaw.incremental as { p95DurationMs?: number })?.p95DurationMs ?? 0),
      averageMutatingQueries: Number(
        (perfRaw.incremental as { averageMutatingQueries?: number })?.averageMutatingQueries ?? 0
      )
    },
    fullReconcile: {
      averageDurationMs: Number(
        (perfRaw.fullReconcile as { averageDurationMs?: number })?.averageDurationMs ?? 0
      ),
      p95DurationMs: Number((perfRaw.fullReconcile as { p95DurationMs?: number })?.p95DurationMs ?? 0),
      averageMutatingQueries: Number(
        (perfRaw.fullReconcile as { averageMutatingQueries?: number })?.averageMutatingQueries ?? 0
      )
    }
  };

  const artifactLinks = parseArtifactLinks(parseMultiArg("--artifact-link"));

  const artifacts =
    artifactLinks.length > 0
      ? artifactLinks
      : [
          {
            label: "Cutover plan evidence",
            path: requiredArg("--cutover-plan-json")
          },
          {
            label: "Cutover apply evidence",
            path: requiredArg("--cutover-apply-json")
          },
          {
            label: "Cutover verify evidence",
            path: requiredArg("--cutover-verify-json")
          },
          {
            label: "Managed incremental validation evidence",
            path: requiredArg("--perf-json")
          }
        ];

  const approvalRef = parseArg("--approval-ref") ?? apply.humanApprovalRef ?? managedValidation.humanApprovalRef;

  const signOffs: ReleaseEvidenceSignOffs = {
    releaseManager: parseRoleSignOff("release-manager"),
    incidentCommander: parseRoleSignOff("incident-commander"),
    platformOperator: parseRoleSignOff("platform-operator"),
    governanceLead: parseRoleSignOff("governance-lead")
  };

  const managedEndpointUrl = parseArg("--managed-postgres-url");

  const bundle: ReleaseGovernanceEvidenceBundle = {
    generatedAt: new Date().toISOString(),
    approvalRef,
    cadenceRun: {
      runId,
      runUrl,
      targetProfile: parseTargetProfile(parseArg("--target-profile")),
      executedAt: parseArg("--executed-at")
    },
    cutover: {
      plan,
      apply,
      verify
    },
    managedValidation,
    artifacts,
    owners: {
      releaseManager: parseArg("--release-manager"),
      incidentCommander: parseArg("--incident-commander"),
      platformOperator: parseArg("--platform-operator"),
      governanceLead: parseArg("--governance-lead")
    },
    signOffs,
    managedEndpoint: {
      redactedUrl: managedEndpointUrl ? redactManagedEndpointUrl(managedEndpointUrl) : undefined,
      source: parseArg("--managed-postgres-source")
    },
    risks: parseMultiArg("--risk"),
    nextActions: parseMultiArg("--next-action")
  };

  const markdown = renderReleaseGovernanceEvidenceMarkdown(bundle);
  const absoluteOutput = resolveOutputPath(outputPath);
  const absoluteJsonOutput = resolveOutputPath(outputJsonPath);
  mkdirSync(dirname(absoluteOutput), { recursive: true });
  mkdirSync(dirname(absoluteJsonOutput), { recursive: true });
  writeFileSync(absoluteOutput, `${markdown}\n`, "utf8");
  writeFileSync(absoluteJsonOutput, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
  console.log(`[release:evidence:bundle] wrote ${absoluteOutput}`);
  console.log(`[release:evidence:bundle] wrote ${absoluteJsonOutput}`);
}

if (process.argv.includes("--help")) {
  console.log(usage());
  process.exit(0);
}

try {
  main();
} catch (error) {
  console.error(
    "[release:evidence:bundle] failed",
    error instanceof Error ? error.message : error
  );
  console.error(usage());
  process.exit(1);
}
