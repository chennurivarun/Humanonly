import { existsSync, statSync } from "node:fs";
import path from "node:path";
import type { StorageAdapter, StorageHealthDetail } from "./adapter";
import type { GovernedStore } from "@/lib/governed-store";
import {
  hydrateGovernedStoreFromFile,
  persistGovernedStoreToFile
} from "@/lib/governed-store";
import { SeedValidationError } from "@/lib/seed";

const DEFAULT_DATA_FILE = ".data/store.json";

function resolveFilePath(envVar: string, defaultRelative: string): string {
  const configured = process.env[envVar]?.trim() || defaultRelative;
  return path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured);
}

/**
 * Legacy JSON snapshot storage adapter.
 *
 * Preserves the original file-backed persistence behaviour for environments
 * that have an existing HUMANONLY_DATA_FILE snapshot and need a compatibility
 * path while migrating to the relational backend.
 *
 * Select this adapter by setting:
 *   HUMANONLY_STORAGE_BACKEND=json-snapshot
 */
export class JsonFileStorageAdapter implements StorageAdapter {
  private readonly filePath: string;

  constructor(filePath?: string) {
    this.filePath =
      filePath ?? resolveFilePath("HUMANONLY_DATA_FILE", DEFAULT_DATA_FILE);
  }

  initialize(): Promise<void> {
    // No schema to create; the JSON file is written lazily on first flush.
    return Promise.resolve();
  }

  loadAll(): Promise<GovernedStore> {
    const store: GovernedStore = { users: [], posts: [], reports: [], appeals: [] };

    if (!existsSync(this.filePath)) {
      return Promise.resolve(store);
    }

    try {
      hydrateGovernedStoreFromFile(store, this.filePath);
    } catch (error) {
      if (error instanceof SeedValidationError) {
        throw new Error(`Failed to load JSON snapshot from ${this.filePath}: ${error.message}`);
      }
      throw error;
    }

    return Promise.resolve(store);
  }

  flush(store: GovernedStore): Promise<void> {
    persistGovernedStoreToFile(store, this.filePath);
    return Promise.resolve();
  }

  healthCheck(): Promise<StorageHealthDetail> {
    if (!existsSync(this.filePath)) {
      return Promise.resolve({
        backend: "json-snapshot",
        healthy: false,
        detail: `JSON snapshot file not found: ${this.filePath}`,
        info: { filePath: this.filePath, exists: false, sizeBytes: null, lastModifiedAt: null }
      });
    }

    try {
      const stat = statSync(this.filePath);
      return Promise.resolve({
        backend: "json-snapshot",
        healthy: true,
        detail: `JSON snapshot file reachable`,
        info: {
          filePath: this.filePath,
          exists: true,
          sizeBytes: stat.size,
          lastModifiedAt: stat.mtime.toISOString()
        }
      });
    } catch (err) {
      return Promise.resolve({
        backend: "json-snapshot",
        healthy: false,
        detail: `JSON snapshot file error: ${(err as Error).message}`,
        info: { filePath: this.filePath, exists: true, sizeBytes: null, lastModifiedAt: null }
      });
    }
  }
}
