import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  collectStoreIntegrityViolations,
  countStoreEntities,
  evaluateCutoverParity,
  storeFingerprint
} from "@/lib/postgres-cutover";
import { GOVERNANCE_ASSERTIONS, type GovernedStore } from "@/lib/governed-store";
import { PostgresStorageAdapter, SqliteStorageAdapter } from "@/lib/storage";

type Action = "plan" | "apply" | "verify";

type CutoverReport = {
  generatedAt: string;
  action: Action;
  governance: typeof GOVERNANCE_ASSERTIONS;
  source: {
    backend: "sqlite";
    sqliteFile: string;
    counts: ReturnType<typeof countStoreEntities>;
    fingerprint: string;
    integrityViolations: ReturnType<typeof collectStoreIntegrityViolations>;
  };
  target?: {
    backend: "postgres";
    counts: ReturnType<typeof countStoreEntities>;
    fingerprint: string;
    integrityViolations: ReturnType<typeof collectStoreIntegrityViolations>;
  };
  parity?: ReturnType<typeof evaluateCutoverParity>;
  humanApprovalRef?: string;
  productionGuardrails: {
    humanExpressionOnly: true;
    aiManagedOperationsOnly: true;
    humanGovernedDecisionsOnly: true;
    auditabilityRequired: true;
    humanOverrideReservedForAdmins: true;
    writeActionExecuted: boolean;
  };
};

const DEFAULT_SQLITE_FILE = ".data/store.db";
const DEFAULT_OUTPUT_PATH = ".tmp/postgres-cutover/report.json";

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

function resolveAction(): Action {
  const raw = (parseArg("--action") ?? "plan").trim().toLowerCase();
  if (raw === "plan" || raw === "apply" || raw === "verify") {
    return raw;
  }

  throw new Error("--action must be one of: plan, apply, verify");
}

function usage(): string {
  return [
    "Usage:",
    "  npm run db:cutover:postgres -w apps/web -- --action=plan [--sqlite-file=.data/store.db] [--postgres-url=postgres://...] [--output=.tmp/postgres-cutover/report.json]",
    "  npm run db:cutover:postgres -w apps/web -- --action=apply --execute --human-approval-ref=CHANGE-123 --postgres-url=postgres://... [--sqlite-file=.data/store.db]",
    "  npm run db:cutover:postgres -w apps/web -- --action=verify --postgres-url=postgres://... [--sqlite-file=.data/store.db]",
    "",
    "Governance:",
    "  - apply mode requires --execute and --human-approval-ref",
    "  - deterministic report is always written for auditability"
  ].join("\n");
}

async function loadSqliteStore(sqliteFile: string): Promise<GovernedStore> {
  const adapter = new SqliteStorageAdapter(sqliteFile);
  await adapter.initialize();
  return adapter.loadAll();
}

async function withPostgresStore<T>(
  postgresUrl: string,
  task: (adapter: PostgresStorageAdapter) => Promise<T>
): Promise<T> {
  const env = {
    ...process.env,
    HUMANONLY_POSTGRES_URL: postgresUrl,
    HUMANONLY_POSTGRES_APPLICATION_NAME: process.env.HUMANONLY_POSTGRES_APPLICATION_NAME ?? "humanonly-cutover"
  };

  const adapter = new PostgresStorageAdapter(undefined, env);
  await adapter.initialize();

  try {
    return await task(adapter);
  } finally {
    await adapter.close().catch((error) => {
      console.error("[cutover] failed to close postgres pool", error);
    });
  }
}

function ensureNoIntegrityViolations(label: string, store: GovernedStore): void {
  const violations = collectStoreIntegrityViolations(store);
  if (violations.length > 0) {
    const first = violations[0];
    throw new Error(
      `${label} integrity failed (${violations.length} violation(s)). Example: ${first?.entity}:${first?.id} missing ${first?.relation}=${first?.missingId}`
    );
  }
}

function writeReport(outputPath: string, report: CutoverReport): void {
  const absolute = resolve(process.cwd(), outputPath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`[cutover] wrote report: ${absolute}`);
}

async function main() {
  const action = resolveAction();
  const sqliteFile = resolve(
    process.cwd(),
    parseArg("--sqlite-file") ?? process.env.HUMANONLY_DB_FILE ?? DEFAULT_SQLITE_FILE
  );
  const outputPath = parseArg("--output") ?? DEFAULT_OUTPUT_PATH;
  const postgresUrl = parseArg("--postgres-url") ?? process.env.HUMANONLY_POSTGRES_URL;
  const humanApprovalRef = parseArg("--human-approval-ref")?.trim() || undefined;
  const execute = parseArg("--execute") !== undefined || process.argv.includes("--execute");

  const source = await loadSqliteStore(sqliteFile);
  const sourceIntegrity = collectStoreIntegrityViolations(source);

  const baseReport: CutoverReport = {
    generatedAt: new Date().toISOString(),
    action,
    governance: GOVERNANCE_ASSERTIONS,
    source: {
      backend: "sqlite",
      sqliteFile,
      counts: countStoreEntities(source),
      fingerprint: storeFingerprint(source),
      integrityViolations: sourceIntegrity
    },
    productionGuardrails: {
      ...GOVERNANCE_ASSERTIONS,
      writeActionExecuted: false
    }
  };

  if (action === "plan") {
    if (!postgresUrl) {
      writeReport(outputPath, baseReport);
      console.log("[cutover] plan complete (sqlite snapshot only; no postgres target configured)");
      return;
    }

    const target = await withPostgresStore(postgresUrl, (adapter) => adapter.loadAll());
    const targetIntegrity = collectStoreIntegrityViolations(target);

    const report: CutoverReport = {
      ...baseReport,
      target: {
        backend: "postgres",
        counts: countStoreEntities(target),
        fingerprint: storeFingerprint(target),
        integrityViolations: targetIntegrity
      },
      parity: evaluateCutoverParity(source, target)
    };

    writeReport(outputPath, report);
    console.log("[cutover] plan complete (sqlite + postgres parity snapshot)");
    return;
  }

  if (!postgresUrl) {
    throw new Error(`--postgres-url (or HUMANONLY_POSTGRES_URL) is required for action=${action}`);
  }

  ensureNoIntegrityViolations("sqlite source", source);

  if (action === "apply") {
    if (!execute) {
      throw new Error("apply mode requires --execute");
    }
    if (!humanApprovalRef) {
      throw new Error("apply mode requires --human-approval-ref=<change-ticket>");
    }

    const target = await withPostgresStore(postgresUrl, async (adapter) => {
      await adapter.flush(source);
      return adapter.loadAll();
    });

    ensureNoIntegrityViolations("postgres target", target);

    const parity = evaluateCutoverParity(source, target);
    if (!parity.countsMatch || !parity.fingerprintMatch) {
      throw new Error("post-cutover verification failed: source/target parity mismatch");
    }

    const report: CutoverReport = {
      ...baseReport,
      humanApprovalRef,
      target: {
        backend: "postgres",
        counts: parity.targetCounts,
        fingerprint: parity.targetFingerprint,
        integrityViolations: []
      },
      parity,
      productionGuardrails: {
        ...baseReport.productionGuardrails,
        writeActionExecuted: true
      }
    };

    writeReport(outputPath, report);
    console.log("[cutover] apply complete (verified parity + integrity)");
    return;
  }

  const target = await withPostgresStore(postgresUrl, (adapter) => adapter.loadAll());
  ensureNoIntegrityViolations("postgres target", target);

  const parity = evaluateCutoverParity(source, target);
  const report: CutoverReport = {
    ...baseReport,
    target: {
      backend: "postgres",
      counts: parity.targetCounts,
      fingerprint: parity.targetFingerprint,
      integrityViolations: []
    },
    parity
  };

  writeReport(outputPath, report);

  if (!parity.countsMatch || !parity.fingerprintMatch) {
    throw new Error("verify failed: source/target parity mismatch");
  }

  console.log("[cutover] verify complete (parity match)");
}

if (process.argv.includes("--help")) {
  console.log(usage());
  process.exit(0);
}

main().catch((error) => {
  console.error("[cutover] failed", error instanceof Error ? error.message : error);
  console.error(usage());
  process.exit(1);
});
