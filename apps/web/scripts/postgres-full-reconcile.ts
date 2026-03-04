import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { collectStoreIntegrityViolations, countStoreEntities, storeFingerprint } from "@/lib/postgres-cutover";
import { GOVERNANCE_ASSERTIONS } from "@/lib/governed-store";
import { PostgresStorageAdapter } from "@/lib/storage";

type ReconcileReport = {
  generatedAt: string;
  governance: typeof GOVERNANCE_ASSERTIONS;
  humanApprovalRef: string;
  countsBefore: ReturnType<typeof countStoreEntities>;
  countsAfter: ReturnType<typeof countStoreEntities>;
  fingerprintBefore: string;
  fingerprintAfter: string;
  integrityViolationsAfter: ReturnType<typeof collectStoreIntegrityViolations>;
  parityMatch: boolean;
};

const DEFAULT_OUTPUT_PATH = ".tmp/postgres-reconcile/report.json";

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

function usage(): string {
  return [
    "Usage:",
    "  npm run db:reconcile:postgres -w apps/web -- --execute --human-approval-ref=CHANGE-123 [--postgres-url=postgres://...] [--output=.tmp/postgres-reconcile/report.json]",
    "",
    "Governance:",
    "  - requires explicit --execute and --human-approval-ref",
    "  - writes deterministic report for auditability"
  ].join("\n");
}

function writeReport(outputPath: string, report: ReconcileReport): void {
  const absolute = resolve(process.cwd(), outputPath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`[reconcile] wrote report: ${absolute}`);
}

async function main() {
  const execute = process.argv.includes("--execute") || parseArg("--execute") !== undefined;
  const humanApprovalRef = parseArg("--human-approval-ref")?.trim();
  const postgresUrl = parseArg("--postgres-url") ?? process.env.HUMANONLY_POSTGRES_URL;
  const outputPath = parseArg("--output") ?? DEFAULT_OUTPUT_PATH;

  if (!execute) {
    throw new Error("reconcile requires --execute");
  }
  if (!humanApprovalRef) {
    throw new Error("reconcile requires --human-approval-ref=<change-ticket>");
  }
  if (!postgresUrl) {
    throw new Error("--postgres-url (or HUMANONLY_POSTGRES_URL) is required");
  }

  const env = {
    ...process.env,
    HUMANONLY_POSTGRES_URL: postgresUrl,
    HUMANONLY_POSTGRES_APPLICATION_NAME: process.env.HUMANONLY_POSTGRES_APPLICATION_NAME ?? "humanonly-reconcile"
  };

  const adapter = new PostgresStorageAdapter(undefined, env);

  try {
    await adapter.initialize();

    const before = await adapter.loadAll();
    const countsBefore = countStoreEntities(before);
    const fingerprintBefore = storeFingerprint(before);

    await adapter.reconcileFull(before);

    const after = await adapter.loadAll();
    const countsAfter = countStoreEntities(after);
    const fingerprintAfter = storeFingerprint(after);
    const integrityViolationsAfter = collectStoreIntegrityViolations(after);

    const parityMatch =
      countsBefore.users === countsAfter.users &&
      countsBefore.posts === countsAfter.posts &&
      countsBefore.reports === countsAfter.reports &&
      countsBefore.appeals === countsAfter.appeals &&
      fingerprintBefore === fingerprintAfter;

    const report: ReconcileReport = {
      generatedAt: new Date().toISOString(),
      governance: GOVERNANCE_ASSERTIONS,
      humanApprovalRef,
      countsBefore,
      countsAfter,
      fingerprintBefore,
      fingerprintAfter,
      integrityViolationsAfter,
      parityMatch
    };

    writeReport(outputPath, report);

    if (integrityViolationsAfter.length > 0) {
      throw new Error(`reconcile completed with ${integrityViolationsAfter.length} integrity violation(s)`);
    }

    if (!parityMatch) {
      throw new Error("reconcile failed parity verification");
    }

    console.log("[reconcile] full reconcile completed with parity verified");
  } finally {
    await adapter.close().catch(() => undefined);
  }
}

if (process.argv.includes("--help")) {
  console.log(usage());
  process.exit(0);
}

main().catch((error) => {
  console.error("[reconcile] failed", error instanceof Error ? error.message : error);
  console.error(usage());
  process.exit(1);
});
