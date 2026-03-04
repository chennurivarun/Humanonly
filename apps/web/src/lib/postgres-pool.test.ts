import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_POSTGRES_CONNECTION_TIMEOUT_MS,
  DEFAULT_POSTGRES_IDLE_TIMEOUT_MS,
  DEFAULT_POSTGRES_POOL_SIZE,
  DEFAULT_POSTGRES_QUERY_TIMEOUT_MS,
  DEFAULT_POSTGRES_STATEMENT_TIMEOUT_MS,
  resolvePostgresPoolPolicy
} from "@/lib/storage/postgres-pool";

describe("resolvePostgresPoolPolicy", () => {
  it("uses non-production defaults when env vars are unset", () => {
    const policy = resolvePostgresPoolPolicy({});

    assert.equal(policy.config.max, DEFAULT_POSTGRES_POOL_SIZE);
    assert.equal(policy.config.idleTimeoutMillis, DEFAULT_POSTGRES_IDLE_TIMEOUT_MS);
    assert.equal(policy.config.connectionTimeoutMillis, DEFAULT_POSTGRES_CONNECTION_TIMEOUT_MS);
    assert.equal(policy.config.statement_timeout, DEFAULT_POSTGRES_STATEMENT_TIMEOUT_MS);
    assert.equal(policy.config.query_timeout, DEFAULT_POSTGRES_QUERY_TIMEOUT_MS);
    assert.equal(policy.config.application_name, "humanonly-web");
    assert.equal(policy.config.ssl, undefined);
    assert.equal(policy.effectiveSslMode, "prefer");
    assert.equal(policy.productionGuardrailApplied, false);
  });

  it("defaults to ssl=require in production", () => {
    const policy = resolvePostgresPoolPolicy({ NODE_ENV: "production" });

    assert.equal(policy.requestedSslMode, "require");
    assert.equal(policy.effectiveSslMode, "require");
    assert.deepEqual(policy.config.ssl, { rejectUnauthorized: false });
  });

  it("accepts explicit pool and timeout overrides", () => {
    const policy = resolvePostgresPoolPolicy({
      HUMANONLY_POSTGRES_POOL_SIZE: "32",
      HUMANONLY_POSTGRES_IDLE_TIMEOUT_MS: "25000",
      HUMANONLY_POSTGRES_CONNECTION_TIMEOUT_MS: "4000",
      HUMANONLY_POSTGRES_STATEMENT_TIMEOUT_MS: "9000",
      HUMANONLY_POSTGRES_QUERY_TIMEOUT_MS: "8000",
      HUMANONLY_POSTGRES_MAX_USES: "1000",
      HUMANONLY_POSTGRES_APPLICATION_NAME: "humanonly-cutover-job",
      HUMANONLY_POSTGRES_SSL_MODE: "prefer"
    });

    assert.equal(policy.config.max, 32);
    assert.equal(policy.config.idleTimeoutMillis, 25000);
    assert.equal(policy.config.connectionTimeoutMillis, 4000);
    assert.equal(policy.config.statement_timeout, 9000);
    assert.equal(policy.config.query_timeout, 8000);
    assert.equal(policy.config.maxUses, 1000);
    assert.equal(policy.config.application_name, "humanonly-cutover-job");
    assert.equal(policy.config.ssl, undefined);
    assert.equal(policy.requestedSslMode, "prefer");
    assert.equal(policy.effectiveSslMode, "prefer");
  });

  it("enforces production guardrail for ssl disable without explicit human approval", () => {
    const policy = resolvePostgresPoolPolicy({
      NODE_ENV: "production",
      HUMANONLY_POSTGRES_SSL_MODE: "disable"
    });

    assert.equal(policy.requestedSslMode, "disable");
    assert.equal(policy.effectiveSslMode, "require");
    assert.equal(policy.productionGuardrailApplied, true);
    assert.deepEqual(policy.config.ssl, { rejectUnauthorized: false });
    assert.match(policy.rationale, /without explicit human approval/i);
  });

  it("allows ssl disable in production only with explicit human approval flag", () => {
    const policy = resolvePostgresPoolPolicy({
      NODE_ENV: "production",
      HUMANONLY_POSTGRES_SSL_MODE: "disable",
      HUMANONLY_POSTGRES_SSL_DISABLE_APPROVED: "1"
    });

    assert.equal(policy.requestedSslMode, "disable");
    assert.equal(policy.effectiveSslMode, "disable");
    assert.equal(policy.productionGuardrailApplied, false);
    assert.equal(policy.config.ssl, false);
  });

  it("throws on invalid numeric env values", () => {
    assert.throws(
      () =>
        resolvePostgresPoolPolicy({
          HUMANONLY_POSTGRES_POOL_SIZE: "not-a-number"
        }),
      /HUMANONLY_POSTGRES_POOL_SIZE/
    );
  });
});
