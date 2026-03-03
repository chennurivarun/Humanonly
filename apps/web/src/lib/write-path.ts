export type WritePathPhase = "validation" | "domain" | "persist" | "audit";

export type WritePathMetrics = {
  validationMs: number;
  domainMs: number;
  persistMs: number;
  auditMs: number;
  totalMs: number;
};

export type AuditWriteModePolicy = {
  requestedMode: "sync" | "async";
  effectiveMode: "sync" | "async";
  productionGuardrailApplied: boolean;
  asyncApproved: boolean;
  approvalReference?: string;
  rationale: string;
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

export function resolveAuditWriteModePolicy(
  env: Record<string, string | undefined> = process.env
): AuditWriteModePolicy {
  const requested = env.HUMANONLY_AUDIT_WRITE_MODE?.trim().toLowerCase() === "async" ? "async" : "sync";
  const nodeEnv = env.NODE_ENV?.trim().toLowerCase();
  const asyncApproved = env.HUMANONLY_AUDIT_ASYNC_APPROVED?.trim() === "1";
  const approvalReference = env.HUMANONLY_AUDIT_ASYNC_APPROVAL_REF?.trim() || undefined;

  if (requested === "sync") {
    return {
      requestedMode: "sync",
      effectiveMode: "sync",
      productionGuardrailApplied: false,
      asyncApproved,
      approvalReference,
      rationale: "sync mode selected (default durable policy)"
    };
  }

  if (nodeEnv !== "production") {
    return {
      requestedMode: "async",
      effectiveMode: "async",
      productionGuardrailApplied: false,
      asyncApproved,
      approvalReference,
      rationale: "async mode allowed outside production for benchmark/testing"
    };
  }

  if (asyncApproved) {
    return {
      requestedMode: "async",
      effectiveMode: "async",
      productionGuardrailApplied: false,
      asyncApproved: true,
      approvalReference,
      rationale: "async mode approved for production via HUMANONLY_AUDIT_ASYNC_APPROVED=1"
    };
  }

  return {
    requestedMode: "async",
    effectiveMode: "sync",
    productionGuardrailApplied: true,
    asyncApproved: false,
    approvalReference,
    rationale:
      "async requested in production without explicit human approval; forcing sync for governance safety"
  };
}

export function auditWriteMode(env: Record<string, string | undefined> = process.env): "sync" | "async" {
  return resolveAuditWriteModePolicy(env).effectiveMode;
}
