export type WritePathPhase = "validation" | "domain" | "persist" | "audit";

export type WritePathMetrics = {
  validationMs: number;
  domainMs: number;
  persistMs: number;
  auditMs: number;
  totalMs: number;
};

export function createWritePathTimer() {
  const startedAt = performance.now();
  const phaseDurations: Record<WritePathPhase, number> = {
    validation: 0,
    domain: 0,
    persist: 0,
    audit: 0
  };

  return {
    measure<T>(phase: WritePathPhase, task: () => T): T {
      const phaseStart = performance.now();
      try {
        return task();
      } finally {
        phaseDurations[phase] += performance.now() - phaseStart;
      }
    },
    async measureAsync<T>(phase: WritePathPhase, task: () => Promise<T>): Promise<T> {
      const phaseStart = performance.now();
      try {
        return await task();
      } finally {
        phaseDurations[phase] += performance.now() - phaseStart;
      }
    },
    snapshot(): WritePathMetrics {
      return {
        validationMs: Number(phaseDurations.validation.toFixed(2)),
        domainMs: Number(phaseDurations.domain.toFixed(2)),
        persistMs: Number(phaseDurations.persist.toFixed(2)),
        auditMs: Number(phaseDurations.audit.toFixed(2)),
        totalMs: Number((performance.now() - startedAt).toFixed(2))
      };
    }
  };
}

export function auditWriteMode(): "sync" | "async" {
  const mode = process.env.HUMANONLY_AUDIT_WRITE_MODE?.trim().toLowerCase();
  return mode === "async" ? "async" : "sync";
}
