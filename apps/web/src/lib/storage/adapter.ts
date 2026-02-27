import type { GovernedStore } from "@/lib/governed-store";

export type StorageBackend = "sqlite" | "json-snapshot" | "postgres";

/**
 * Detail returned by each adapter's health check, suitable for surfacing
 * in the reliability status API.
 */
export type StorageHealthDetail = {
  backend: StorageBackend;
  healthy: boolean;
  detail: string;
  /** Optional file-level metadata when the backend is file-based. */
  info?: {
    filePath?: string;
    exists?: boolean;
    sizeBytes?: number | null;
    lastModifiedAt?: string | null;
  };
};

/**
 * Storage abstraction for governed app state.
 *
 * All methods are async to support both synchronous (SQLite, JSON file) and
 * network-backed (PostgreSQL) implementations. Synchronous adapters simply
 * return `Promise.resolve(result)`.
 *
 * Implementations must preserve all governance invariants:
 * - Human expression only
 * - AI-managed operations only
 * - Human-governed decisions only
 * - Auditability required
 * - Admin-only human override
 */
export interface StorageAdapter {
  /**
   * Create schema and prepare storage. Idempotent — safe to call on an
   * already-initialized store.
   */
  initialize(): Promise<void>;

  /**
   * Load all governed entities from durable storage.
   * Returns a GovernedStore whose arrays are populated from the backend.
   */
  loadAll(): Promise<GovernedStore>;

  /**
   * Atomically write all governed entities to durable storage.
   * Called after every mutation to ensure durability.
   */
  flush(store: GovernedStore): Promise<void>;

  /**
   * Check whether durable storage is reachable and healthy.
   * Used by the reliability status API.
   */
  healthCheck(): Promise<StorageHealthDetail>;
}
