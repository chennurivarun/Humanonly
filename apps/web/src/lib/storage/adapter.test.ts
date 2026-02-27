import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { createStorageAdapter, SqliteStorageAdapter, JsonFileStorageAdapter, PostgresStorageAdapter } from "./index";
import { createDefaultSeedSnapshot, writeSeedSnapshotToFile } from "@/lib/seed";

// ── createStorageAdapter factory ──────────────────────────────────────────────

describe("createStorageAdapter", () => {
  it("returns SqliteStorageAdapter by default", () => {
    delete process.env.HUMANONLY_STORAGE_BACKEND;
    const adapter = createStorageAdapter();
    assert.ok(adapter instanceof SqliteStorageAdapter);
  });

  it("returns SqliteStorageAdapter when HUMANONLY_STORAGE_BACKEND=sqlite", () => {
    process.env.HUMANONLY_STORAGE_BACKEND = "sqlite";
    const adapter = createStorageAdapter();
    assert.ok(adapter instanceof SqliteStorageAdapter);
    delete process.env.HUMANONLY_STORAGE_BACKEND;
  });

  it("returns JsonFileStorageAdapter when HUMANONLY_STORAGE_BACKEND=json-snapshot", () => {
    process.env.HUMANONLY_STORAGE_BACKEND = "json-snapshot";
    const adapter = createStorageAdapter();
    assert.ok(adapter instanceof JsonFileStorageAdapter);
    delete process.env.HUMANONLY_STORAGE_BACKEND;
  });

  it("returns PostgresStorageAdapter when HUMANONLY_STORAGE_BACKEND=postgres", () => {
    process.env.HUMANONLY_STORAGE_BACKEND = "postgres";
    // Provide a dummy URL — pg.Pool does not connect in the constructor
    process.env.HUMANONLY_POSTGRES_URL = "postgres://localhost/test";
    const adapter = createStorageAdapter();
    assert.ok(adapter instanceof PostgresStorageAdapter);
    delete process.env.HUMANONLY_STORAGE_BACKEND;
    delete process.env.HUMANONLY_POSTGRES_URL;
  });
});

// ── JsonFileStorageAdapter ────────────────────────────────────────────────────

describe("JsonFileStorageAdapter", () => {
  it("returns empty store when file is absent", async () => {
    const adapter = new JsonFileStorageAdapter("/nonexistent/store.json");
    await adapter.initialize();
    const store = await adapter.loadAll();
    assert.deepEqual(store, { users: [], posts: [], reports: [], appeals: [] });
  });

  it("loads and round-trips a valid JSON snapshot file", async () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), "humanonly-jf-"));
    const filePath = path.join(tempDir, "store.json");

    const snapshot = createDefaultSeedSnapshot("2026-02-01T00:00:00.000Z");
    writeSeedSnapshotToFile(snapshot, filePath);

    const adapter = new JsonFileStorageAdapter(filePath);
    await adapter.initialize();
    const store = await adapter.loadAll();

    assert.ok(store.users.length > 0);
    assert.ok(store.posts.length > 0);
    assert.ok(store.reports.length > 0);
    assert.ok(store.appeals.length > 0);
  });

  it("flush writes a valid JSON snapshot", async () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), "humanonly-jf-flush-"));
    const filePath = path.join(tempDir, "store.json");

    const snapshot = createDefaultSeedSnapshot("2026-02-01T00:00:00.000Z");
    writeSeedSnapshotToFile(snapshot, filePath);

    const adapter = new JsonFileStorageAdapter(filePath);
    await adapter.initialize();
    const loaded = await adapter.loadAll();

    // Flush back (should not throw)
    await adapter.flush(loaded);

    // Reload to verify round-trip
    const reloaded = await adapter.loadAll();
    assert.equal(reloaded.users.length, loaded.users.length);
    assert.equal(reloaded.posts.length, loaded.posts.length);
  });

  it("reports healthy when file exists", async () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), "humanonly-jf-health-"));
    const filePath = path.join(tempDir, "store.json");
    writeFileSync(filePath, JSON.stringify({ version: 1 }), "utf8");

    const adapter = new JsonFileStorageAdapter(filePath);
    const health = await adapter.healthCheck();

    assert.equal(health.backend, "json-snapshot");
    assert.equal(health.healthy, true);
    assert.equal(health.info?.exists, true);
  });

  it("reports unhealthy when file is absent", async () => {
    const adapter = new JsonFileStorageAdapter("/nonexistent/store.json");
    const health = await adapter.healthCheck();

    assert.equal(health.backend, "json-snapshot");
    assert.equal(health.healthy, false);
    assert.equal(health.info?.exists, false);
  });
});

// ── SQLite bootstrap from JSON seed file (compat migration path) ──────────────

describe("SQLite adapter initialized from JSON seed (compat path)", () => {
  it("adapter initialized from seed is queryable", async () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), "humanonly-compat-"));
    const dbPath = path.join(tempDir, "store.db");

    const snapshot = createDefaultSeedSnapshot("2026-02-01T00:00:00.000Z");
    const jsonPath = path.join(tempDir, "seed.json");
    writeSeedSnapshotToFile(snapshot, jsonPath);

    // Load seed via JSON adapter, then flush into SQLite
    const jsonAdapter = new JsonFileStorageAdapter(jsonPath);
    await jsonAdapter.initialize();
    const store = await jsonAdapter.loadAll();

    const sqliteAdapter = new SqliteStorageAdapter(dbPath);
    await sqliteAdapter.initialize();
    await sqliteAdapter.flush(store);

    const reloaded = await sqliteAdapter.loadAll();
    assert.equal(reloaded.users.length, store.users.length);
    assert.equal(reloaded.posts.length, store.posts.length);
    assert.equal(reloaded.reports.length, store.reports.length);
    assert.equal(reloaded.appeals.length, store.appeals.length);
  });
});
