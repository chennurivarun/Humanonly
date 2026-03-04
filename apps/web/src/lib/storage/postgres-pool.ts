import type { PoolConfig } from "pg";

export const DEFAULT_POSTGRES_POOL_SIZE = 20;
export const DEFAULT_POSTGRES_IDLE_TIMEOUT_MS = 10_000;
export const DEFAULT_POSTGRES_CONNECTION_TIMEOUT_MS = 5_000;
export const DEFAULT_POSTGRES_STATEMENT_TIMEOUT_MS = 5_000;
export const DEFAULT_POSTGRES_QUERY_TIMEOUT_MS = 5_000;
export const DEFAULT_POSTGRES_MAX_USES = 0;

type SslMode = "require" | "prefer" | "disable";

export type PostgresPoolPolicy = {
  config: Omit<PoolConfig, "connectionString">;
  requestedSslMode: SslMode;
  effectiveSslMode: SslMode;
  productionGuardrailApplied: boolean;
  sslDisableApproved: boolean;
  rationale: string;
};

function parsePositiveInteger(
  value: string | undefined,
  {
    name,
    fallback,
    min,
    max
  }: {
    name: string;
    fallback: number;
    min: number;
    max: number;
  }
): number {
  const trimmed = value?.trim();
  if (!trimmed) {
    return fallback;
  }

  if (!/^\d+$/.test(trimmed)) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }

  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }

  return parsed;
}

function parseSslMode(value: string | undefined, isProduction: boolean): SslMode {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) {
    return isProduction ? "require" : "prefer";
  }

  if (normalized === "require") {
    return "require";
  }
  if (normalized === "prefer") {
    return "prefer";
  }
  if (normalized === "disable") {
    return "disable";
  }

  throw new Error("HUMANONLY_POSTGRES_SSL_MODE must be one of: require, prefer, disable");
}

export function resolvePostgresPoolPolicy(
  env: Record<string, string | undefined> = process.env
): PostgresPoolPolicy {
  const max = parsePositiveInteger(env.HUMANONLY_POSTGRES_POOL_SIZE, {
    name: "HUMANONLY_POSTGRES_POOL_SIZE",
    fallback: DEFAULT_POSTGRES_POOL_SIZE,
    min: 1,
    max: 200
  });

  const idleTimeoutMillis = parsePositiveInteger(env.HUMANONLY_POSTGRES_IDLE_TIMEOUT_MS, {
    name: "HUMANONLY_POSTGRES_IDLE_TIMEOUT_MS",
    fallback: DEFAULT_POSTGRES_IDLE_TIMEOUT_MS,
    min: 100,
    max: 120_000
  });

  const connectionTimeoutMillis = parsePositiveInteger(env.HUMANONLY_POSTGRES_CONNECTION_TIMEOUT_MS, {
    name: "HUMANONLY_POSTGRES_CONNECTION_TIMEOUT_MS",
    fallback: DEFAULT_POSTGRES_CONNECTION_TIMEOUT_MS,
    min: 100,
    max: 120_000
  });

  const statementTimeout = parsePositiveInteger(env.HUMANONLY_POSTGRES_STATEMENT_TIMEOUT_MS, {
    name: "HUMANONLY_POSTGRES_STATEMENT_TIMEOUT_MS",
    fallback: DEFAULT_POSTGRES_STATEMENT_TIMEOUT_MS,
    min: 100,
    max: 120_000
  });

  const queryTimeout = parsePositiveInteger(env.HUMANONLY_POSTGRES_QUERY_TIMEOUT_MS, {
    name: "HUMANONLY_POSTGRES_QUERY_TIMEOUT_MS",
    fallback: DEFAULT_POSTGRES_QUERY_TIMEOUT_MS,
    min: 100,
    max: 120_000
  });

  const maxUses = parsePositiveInteger(env.HUMANONLY_POSTGRES_MAX_USES, {
    name: "HUMANONLY_POSTGRES_MAX_USES",
    fallback: DEFAULT_POSTGRES_MAX_USES,
    min: 0,
    max: 1_000_000
  });

  const isProduction = env.NODE_ENV?.trim().toLowerCase() === "production";
  const requestedSslMode = parseSslMode(env.HUMANONLY_POSTGRES_SSL_MODE, isProduction);
  const sslDisableApproved = env.HUMANONLY_POSTGRES_SSL_DISABLE_APPROVED?.trim() === "1";

  let effectiveSslMode: SslMode = requestedSslMode;
  let productionGuardrailApplied = false;
  let rationale = "pool defaults resolved";

  if (isProduction && requestedSslMode === "disable" && !sslDisableApproved) {
    effectiveSslMode = "require";
    productionGuardrailApplied = true;
    rationale =
      "HUMANONLY_POSTGRES_SSL_MODE=disable requested in production without explicit human approval; forcing ssl=require";
  }

  const ssl =
    effectiveSslMode === "disable"
      ? false
      : effectiveSslMode === "require"
        ? {
            rejectUnauthorized: false
          }
        : undefined;

  return {
    config: {
      max,
      idleTimeoutMillis,
      connectionTimeoutMillis,
      statement_timeout: statementTimeout,
      query_timeout: queryTimeout,
      maxUses,
      application_name: env.HUMANONLY_POSTGRES_APPLICATION_NAME?.trim() || "humanonly-web",
      ssl
    },
    requestedSslMode,
    effectiveSslMode,
    productionGuardrailApplied,
    sslDisableApproved,
    rationale
  };
}
