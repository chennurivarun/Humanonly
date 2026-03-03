import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, relative, resolve } from "node:path";
import {
  renderStorageBackendBenchmarkReport,
  toCompareRows,
  type HarnessSummary,
  type PostgresSource
} from "@/lib/storage-backend-benchmark";

type Backend = "sqlite" | "postgres";

type PostgresRuntime = {
  source: PostgresSource;
  url: string;
  cleanup: () => Promise<void>;
};

const DEFAULT_TMP_DIR = ".tmp/perf-backend-compare";

function parseArg(flag: string): string | undefined {
  const idx = process.argv.findIndex((token) => token === flag || token.startsWith(`${flag}=`));
  if (idx === -1) return undefined;
  const token = process.argv[idx];
  if (token?.includes("=")) return token.split("=").slice(1).join("=");
  const next = process.argv[idx + 1];
  return next && !next.startsWith("--") ? next : undefined;
}

function parseNumberArg(flag: string): number | undefined {
  const raw = parseArg(flag);
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function ensurePostgresUrlFromEnv(): string | undefined {
  return process.env.HUMANONLY_POSTGRES_URL?.trim() || undefined;
}

async function findAvailablePort(portHint = 0): Promise<number> {
  return await new Promise<number>((resolvePort, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(portHint, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Failed to resolve an available localhost port"));
        return;
      }

      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }
        resolvePort(address.port);
      });
    });
  });
}

async function startEmbeddedPostgres(tmpDir: string): Promise<PostgresRuntime> {
  let EmbeddedPostgresCtor: new (options: Record<string, unknown>) => {
    initialise: () => Promise<void>;
    start: () => Promise<void>;
    createDatabase: (database: string) => Promise<void>;
    stop: () => Promise<void>;
  };

  try {
    const embeddedPostgres = await import("embedded-postgres");
    EmbeddedPostgresCtor = embeddedPostgres.default as typeof EmbeddedPostgresCtor;
  } catch (error) {
    throw new Error(
      `No HUMANONLY_POSTGRES_URL found and embedded-postgres failed to load. Install deps and retry. Cause: ${(error as Error).message}`
    );
  }

  const rootDir = resolve(`${tmpDir}/embedded-postgres`);
  const dataDir = resolve(`${rootDir}/data`);
  const user = "humanonly_runner";
  const password = "humanonly_runner";
  const database = "humanonly_benchmark";
  const requestedPort = parseNumberArg("--embedded-postgres-port") ?? 0;
  const port = await findAvailablePort(requestedPort);

  rmSync(rootDir, { recursive: true, force: true });
  mkdirSync(rootDir, { recursive: true });

  const embedded = new EmbeddedPostgresCtor({
    databaseDir: dataDir,
    user,
    password,
    port,
    persistent: false,
    onLog: () => undefined,
    onError: (message: unknown) => {
      const text = typeof message === "string" ? message : JSON.stringify(message);
      console.error(`[embedded-postgres] ${text}`);
    }
  });

  await embedded.initialise();
  await embedded.start();
  await embedded.createDatabase(database);

  const url = `postgres://${user}:${encodeURIComponent(password)}@127.0.0.1:${port}/${database}`;

  return {
    source: "embedded",
    url,
    cleanup: async () => {
      await embedded.stop();
      rmSync(rootDir, { recursive: true, force: true });
    }
  };
}

async function resolvePostgresRuntime(tmpDir: string): Promise<PostgresRuntime> {
  const cliUrl = parseArg("--postgres-url")?.trim();
  if (cliUrl) {
    return {
      source: "cli",
      url: cliUrl,
      cleanup: async () => undefined
    };
  }

  const envUrl = ensurePostgresUrlFromEnv();
  if (envUrl) {
    return {
      source: "env",
      url: envUrl,
      cleanup: async () => undefined
    };
  }

  return startEmbeddedPostgres(tmpDir);
}

function runHarness(backend: Backend, jsonOutput: string, postgresUrl: string, tmpDir: string) {
  const env = { ...process.env };
  const auditPath = resolve(`${tmpDir}/${backend}/audit-log.jsonl`);

  env.HUMANONLY_AUDIT_WRITE_MODE = "sync";
  env.HUMANONLY_AUDIT_LOG_FILE = auditPath;

  if (backend === "sqlite") {
    env.HUMANONLY_STORAGE_BACKEND = "sqlite";
    env.HUMANONLY_DB_FILE = resolve(`${tmpDir}/sqlite/store.db`);
  } else {
    env.HUMANONLY_STORAGE_BACKEND = "postgres";
    env.HUMANONLY_POSTGRES_URL = postgresUrl;
    delete env.HUMANONLY_DB_FILE;
  }

  const result = spawnSync(
    "npm",
    ["run", "perf:harness", "--", "--audit-mode=sync", `--json-output=${jsonOutput}`, "--silent"],
    {
      cwd: process.cwd(),
      env,
      stdio: "inherit"
    }
  );

  if (result.status !== 0) {
    throw new Error(`Performance harness failed for ${backend} (exit=${result.status ?? "unknown"})`);
  }
}

async function main() {
  const appRoot = process.cwd();
  const repoRoot = resolve(appRoot, "..", "..");

  const tmpDirArg = parseArg("--tmp-dir");
  const tmpDir = tmpDirArg ? resolve(appRoot, tmpDirArg) : resolve(appRoot, DEFAULT_TMP_DIR);
  const sqliteJsonArg = parseArg("--sqlite-json");
  const postgresJsonArg = parseArg("--postgres-json");
  const markdownOutputArg = parseArg("--markdown-output");

  const sqliteJson = resolve(appRoot, sqliteJsonArg ?? `${tmpDir}/sqlite.json`);
  const postgresJson = resolve(appRoot, postgresJsonArg ?? `${tmpDir}/postgres.json`);
  const markdownOutput = markdownOutputArg
    ? resolve(repoRoot, markdownOutputArg)
    : resolve(repoRoot, "docs/SPRINT_6_STORAGE_BACKEND_BENCHMARK.md");

  mkdirSync(dirname(sqliteJson), { recursive: true });
  mkdirSync(dirname(postgresJson), { recursive: true });
  mkdirSync(dirname(markdownOutput), { recursive: true });

  const postgresRuntime = await resolvePostgresRuntime(tmpDir);

  try {
    runHarness("sqlite", sqliteJson, postgresRuntime.url, tmpDir);
    runHarness("postgres", postgresJson, postgresRuntime.url, tmpDir);

    const sqliteSummary = JSON.parse(readFileSync(sqliteJson, "utf8")) as HarnessSummary;
    const postgresSummary = JSON.parse(readFileSync(postgresJson, "utf8")) as HarnessSummary;

    const rows = toCompareRows(sqliteSummary, postgresSummary);
    const toRepoPath = (absolutePath: string) => relative(repoRoot, absolutePath) || ".";
    const report = renderStorageBackendBenchmarkReport({
      generatedAt: new Date().toISOString(),
      auditMode: "sync",
      rows,
      sqliteJsonPath: toRepoPath(sqliteJson),
      postgresJsonPath: toRepoPath(postgresJson),
      postgresSource: postgresRuntime.source,
      postgresUrl: postgresRuntime.url
    });

    writeFileSync(markdownOutput, `${report}\n`, "utf8");
    console.log(`Wrote backend benchmark report to ${markdownOutput}`);
  } finally {
    await postgresRuntime.cleanup().catch((error) => {
      console.error("Failed to clean up postgres runtime", error);
    });
  }
}

main().catch((error) => {
  console.error("Storage backend compare failed", error);
  process.exit(1);
});
