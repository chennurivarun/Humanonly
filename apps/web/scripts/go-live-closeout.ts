import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  createGoLiveCloseoutReport,
  renderGoLiveCloseoutMarkdown,
  type GoLiveDecisionStatus
} from "@/lib/go-live-closeout";
import type { ReleaseGovernanceEvidenceBundle } from "@/lib/release-governance-evidence";

const DEFAULT_OUTPUT_MD = "docs/SPRINT_7_GO_LIVE_CLOSEOUT_REPORT.md";
const DEFAULT_OUTPUT_JSON = "docs/SPRINT_7_GO_LIVE_CLOSEOUT_REPORT.json";

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

function requiredArg(flag: string): string {
  const value = parseArg(flag)?.trim();
  if (!value) {
    throw new Error(`missing required argument: ${flag}`);
  }
  return value;
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
  return JSON.parse(readFileSync(absolute, "utf8")) as T;
}

function parseDecisionStatus(raw: string | undefined): GoLiveDecisionStatus | undefined {
  const normalized = raw?.trim().toLowerCase();
  if (!normalized) return undefined;

  if (normalized === "approved" || normalized === "rejected" || normalized === "deferred") {
    return normalized;
  }

  throw new Error(`invalid --decision value: ${raw}`);
}

function usage(): string {
  return [
    "Usage:",
    "  npm run go-live:closeout -w apps/web -- \\",
    "    --bundle-json=docs/SPRINT_7_RELEASE_EVIDENCE_BUNDLE.json",
    "",
    "Optional:",
    `  --output=${DEFAULT_OUTPUT_MD}`,
    `  --output-json=${DEFAULT_OUTPUT_JSON}`,
    "  --decision=approved|rejected|deferred",
    "  --decision-ref=CHANGE-2026-03-05-GO-LIVE",
    "  --decision-by='Release Board'",
    "  --decision-at=2026-03-05T11:00:00Z",
    "  --decision-notes='Approved after final gate review'",
    "  --release-manager-contact=release.manager@example.com",
    "  --incident-commander-contact=incident.commander@example.com",
    "  --platform-operator-contact=platform.operator@example.com",
    "  --governance-lead-contact=governance.lead@example.com"
  ].join("\n");
}

function main() {
  const bundle = parseJsonFile<ReleaseGovernanceEvidenceBundle>(requiredArg("--bundle-json"));

  const decisionStatus = parseDecisionStatus(parseArg("--decision"));
  const decision = decisionStatus
    ? {
        status: decisionStatus,
        approvalRef: requiredArg("--decision-ref"),
        decidedBy: requiredArg("--decision-by"),
        decidedAt: requiredArg("--decision-at"),
        notes: parseArg("--decision-notes")
      }
    : undefined;

  const report = createGoLiveCloseoutReport(bundle, {
    decision,
    signOffContacts: {
      releaseManager: parseArg("--release-manager-contact"),
      incidentCommander: parseArg("--incident-commander-contact"),
      platformOperator: parseArg("--platform-operator-contact"),
      governanceLead: parseArg("--governance-lead-contact")
    }
  });

  const markdown = renderGoLiveCloseoutMarkdown(report);
  const outputPath = resolveOutputPath(parseArg("--output") ?? DEFAULT_OUTPUT_MD);
  const outputJsonPath = resolveOutputPath(parseArg("--output-json") ?? DEFAULT_OUTPUT_JSON);

  mkdirSync(dirname(outputPath), { recursive: true });
  mkdirSync(dirname(outputJsonPath), { recursive: true });
  writeFileSync(outputPath, `${markdown}\n`, "utf8");
  writeFileSync(outputJsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(`[go-live:closeout] wrote ${outputPath}`);
  console.log(`[go-live:closeout] wrote ${outputJsonPath}`);
}

if (process.argv.includes("--help")) {
  console.log(usage());
  process.exit(0);
}

try {
  main();
} catch (error) {
  console.error("[go-live:closeout] failed", error instanceof Error ? error.message : error);
  console.error(usage());
  process.exit(1);
}
