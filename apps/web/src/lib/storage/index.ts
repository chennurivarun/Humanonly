import type { StorageAdapter } from "./adapter";
import { SqliteStorageAdapter } from "./sqlite";
import { JsonFileStorageAdapter } from "./json-file";

export type { StorageAdapter, StorageBackend, StorageHealthDetail } from "./adapter";
export { SqliteStorageAdapter } from "./sqlite";
export { JsonFileStorageAdapter } from "./json-file";

/**
 * Create the appropriate StorageAdapter for the current environment.
 *
 * Backend selection (via HUMANONLY_STORAGE_BACKEND env var):
 *   - "sqlite"        (default) — relational SQLite database at HUMANONLY_DB_FILE
 *   - "json-snapshot"           — legacy JSON file at HUMANONLY_DATA_FILE
 */
export function createStorageAdapter(): StorageAdapter {
  const backend = process.env.HUMANONLY_STORAGE_BACKEND?.trim().toLowerCase();

  if (backend === "json-snapshot") {
    return new JsonFileStorageAdapter();
  }

  // Default: relational SQLite backend
  return new SqliteStorageAdapter();
}
