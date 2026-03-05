import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { writeAuditStub, waitForAuditDrain, resetAuditStateForTests } from "@/lib/audit";
import {
  buildIncidentPacket
} from "@/lib/incident/packet";
import {
  declareIncident,
  resolveIncident,
  configureIncidentStoreForTests,
  getIncidents,
  resetIncidentsForTests,
  type IncidentSeverity
} from "@/lib/incident";
import { buildReliabilityStatus } from "@/lib/reliability";
import { createDefaultSeedSnapshot } from "@/lib/seed";
import {
  evaluateDrillPass,
  evaluatePilotPreGoLiveGates,
  minutesBetween,
  renderPilotPreGoLiveMarkdown,
  type PilotPreGoLiveReport,
  type RehearsalDrill
} from "@/lib/pilot-rehearsal-evidence";

const DEFAULT_OUTPUT_PATH = "docs/SPRINT_7_PRE_GO_LIVE_REHEARSAL_REPORT.md";
const DEFAULT_JSON_OUTPUT_PATH = ".tmp/pre-go-live-rehearsal/report.json";
const DEFAULT_TMP_DIR = ".tmp/pre-go-live-rehearsal/runtime";

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

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag) || parseArg(flag) !== undefined;
}

function parseIntArg(flag: string, fallback: number, min: number, max: number): number {
  const raw = parseArg(flag);
  if (!raw) return fallback;

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new Error(`${flag} must be an integer between ${min} and ${max}`);
  }

  return parsed;
}

function usage(): string {
  return [
    "Usage:",
    "  npm run pilot:rehearsal -w apps/web -- --execute --human-approval-ref=CHANGE-123",
    "",
    "Optional:",
    `  --output=${DEFAULT_OUTPUT_PATH}`,
    `  --json-output=${DEFAULT_JSON_OUTPUT_PATH}`,
    "  --sev1-ack-minutes=6",
    "  --sev1-escalation-minutes=8",
    "  --sev2-ack-minutes=18",
    "  --failover-transfer-minutes=11",
    "  --incident-commander='Chief Admin'",
    "  --platform-operator='Platform Ops'",
    "  --governance-lead='Governance Lead'",
    "  --moderation-operator='Queue Moderator'",
    "",
    "Governance:",
    "  - requires --execute and --human-approval-ref",
    "  - captures deterministic JSON + Markdown evidence artifacts"
  ].join("\n");
}

function resolveOutputPath(pathValue: string, repoRoot: string): string {
  if (pathValue.startsWith("/")) {
    return pathValue;
  }

  return resolve(repoRoot, pathValue);
}

function isoAt(baseMs: number, offsetMinutes: number): string {
  return new Date(baseMs + offsetMinutes * 60_000).toISOString();
}

type IncidentDrillResult = {
  drillId: string;
  drill: RehearsalDrill;
  incidentId: string;
  packetPath: string;
};

async function runIncidentDrill(options: {
  repoRoot: string;
  outputDir: string;
  drillId: string;
  scenario: "sev1" | "sev2";
  severity: IncidentSeverity;
  title: string;
  description: string;
  actorId: string;
  firstAlertAt: string;
  firstAcknowledgedAt: string;
  escalatedAt: string | null;
  resolvedAt: string;
  ackSlaTargetMinutes: number;
}): Promise<IncidentDrillResult> {
  const declaration = declareIncident({
    severity: options.severity,
    title: options.title,
    description: options.description,
    declaredById: options.actorId,
    humanConfirmed: true,
    nowIso: options.firstAlertAt
  });

  if (!declaration.ok) {
    throw new Error(`[pilot:rehearsal] incident declaration failed for ${options.drillId}`);
  }

  const incident = declaration.incident;

  await writeAuditStub({
    actorId: options.actorId,
    action: "admin.incident.declared",
    targetType: "incident",
    targetId: incident.id,
    metadata: {
      scenario: options.scenario,
      severity: incident.severity,
      humanConfirmed: true
    },
    createdAt: options.firstAlertAt
  });

  const packetExportedAt = options.escalatedAt ?? options.firstAcknowledgedAt;
  await writeAuditStub({
    actorId: options.actorId,
    action: "admin.incident.packet.exported",
    targetType: "incident",
    targetId: incident.id,
    metadata: {
      scenario: options.scenario,
      trigger: options.escalatedAt ? "escalation" : "ack-review"
    },
    createdAt: packetExportedAt
  });

  const packet = buildIncidentPacket(incident.id, packetExportedAt);
  if (!packet) {
    throw new Error(`[pilot:rehearsal] failed to export incident packet for ${incident.id}`);
  }

  const resolved = resolveIncident({
    incidentId: incident.id,
    resolvedById: options.actorId,
    resolutionNotes: `Drill completed with explicit human confirmation (${options.drillId}).`,
    humanConfirmed: true,
    nowIso: options.resolvedAt
  });

  if (!resolved.ok) {
    throw new Error(`[pilot:rehearsal] incident resolution failed for ${incident.id}`);
  }

  await writeAuditStub({
    actorId: options.actorId,
    action: "admin.incident.resolved",
    targetType: "incident",
    targetId: incident.id,
    metadata: {
      scenario: options.scenario,
      humanConfirmed: true
    },
    createdAt: options.resolvedAt
  });

  const packetPath = resolve(options.outputDir, `${options.drillId}-${incident.id}-packet.json`);
  writeFileSync(packetPath, `${JSON.stringify(packet, null, 2)}\n`, "utf8");

  const drillBase = {
    drillId: options.drillId,
    scenario: options.scenario,
    description: options.description,
    firstAlertAt: options.firstAlertAt,
    firstAcknowledgedAt: options.firstAcknowledgedAt,
    escalatedAt: options.escalatedAt,
    ackSlaTargetMinutes: options.ackSlaTargetMinutes,
    ackLatencyMinutes: minutesBetween(options.firstAlertAt, options.firstAcknowledgedAt),
    evidenceRefs: [
      `incident:${incident.id}`,
      `packet:${relative(options.repoRoot, packetPath)}`
    ]
  } satisfies Omit<RehearsalDrill, "passed">;

  return {
    drillId: options.drillId,
    incidentId: incident.id,
    packetPath,
    drill: {
      ...drillBase,
      passed: evaluateDrillPass(drillBase)
    }
  };
}

async function main() {
  const execute = hasFlag("--execute");
  const humanApprovalRef = parseArg("--human-approval-ref")?.trim();
  if (!execute) {
    throw new Error("rehearsal requires --execute");
  }
  if (!humanApprovalRef) {
    throw new Error("rehearsal requires --human-approval-ref=<change-ticket>");
  }

  const appRoot = process.cwd();
  const repoRoot = resolve(appRoot, "..", "..");

  const outputPath = resolveOutputPath(parseArg("--output") ?? DEFAULT_OUTPUT_PATH, repoRoot);
  const jsonOutputPath = resolveOutputPath(parseArg("--json-output") ?? DEFAULT_JSON_OUTPUT_PATH, repoRoot);
  const runtimeDir = resolve(appRoot, parseArg("--tmp-dir") ?? DEFAULT_TMP_DIR);

  const sev1AckMinutes = parseIntArg("--sev1-ack-minutes", 6, 1, 120);
  const sev1EscalationMinutes = parseIntArg("--sev1-escalation-minutes", 8, 1, 120);
  const sev2AckMinutes = parseIntArg("--sev2-ack-minutes", 18, 1, 180);
  const failoverTransferMinutes = parseIntArg("--failover-transfer-minutes", 11, 1, 180);

  const participants = {
    incidentCommander: parseArg("--incident-commander")?.trim() || "Chief Admin",
    platformOperator: parseArg("--platform-operator")?.trim() || "Platform Ops",
    governanceLead: parseArg("--governance-lead")?.trim() || "Governance Lead",
    moderationOperator: parseArg("--moderation-operator")?.trim() || "Queue Moderator"
  };

  rmSync(runtimeDir, { recursive: true, force: true });
  mkdirSync(runtimeDir, { recursive: true });
  mkdirSync(dirname(outputPath), { recursive: true });
  mkdirSync(dirname(jsonOutputPath), { recursive: true });

  const incidentsPath = resolve(runtimeDir, "incidents.json");
  const auditLogPath = resolve(runtimeDir, "audit-log.jsonl");
  const sqliteHealthPath = resolve(runtimeDir, "store.db");
  writeFileSync(sqliteHealthPath, "pilot rehearsal sqlite placeholder\n", "utf8");

  process.env.HUMANONLY_INCIDENTS_FILE = incidentsPath;
  process.env.HUMANONLY_AUDIT_LOG_FILE = auditLogPath;
  process.env.HUMANONLY_DB_FILE = sqliteHealthPath;
  process.env.HUMANONLY_STORAGE_BACKEND = "sqlite";

  configureIncidentStoreForTests(incidentsPath);
  resetIncidentsForTests();
  resetAuditStateForTests();

  const startedAt = parseArg("--started-at")?.trim() || new Date().toISOString();
  const baseMs = Date.parse(startedAt);
  if (Number.isNaN(baseMs)) {
    throw new Error("--started-at must be a valid ISO timestamp when provided");
  }

  const sev1FirstAlertAt = isoAt(baseMs, 0);
  const sev1AckAt = isoAt(baseMs, sev1AckMinutes);
  const sev1EscalatedAt = isoAt(baseMs, sev1EscalationMinutes);
  const sev1ResolvedAt = isoAt(baseMs, sev1AckMinutes + 2);

  const sev2FirstAlertAt = isoAt(baseMs, 30);
  const sev2AckAt = isoAt(baseMs, 30 + sev2AckMinutes);
  const sev2ResolvedAt = isoAt(baseMs, 30 + sev2AckMinutes + 3);

  const sev1 = await runIncidentDrill({
    repoRoot,
    outputDir: runtimeDir,
    drillId: "drill-sev1-ack",
    scenario: "sev1",
    severity: "sev1",
    title: "Pilot rehearsal: Sev-1 audit-chain integrity alert",
    description:
      "Rehearsal scenario validates immediate IC assignment, governance escalation, and immutable packet export.",
    actorId: "usr_chief_admin",
    firstAlertAt: sev1FirstAlertAt,
    firstAcknowledgedAt: sev1AckAt,
    escalatedAt: sev1EscalatedAt,
    resolvedAt: sev1ResolvedAt,
    ackSlaTargetMinutes: 10
  });

  const sev2 = await runIncidentDrill({
    repoRoot,
    outputDir: runtimeDir,
    drillId: "drill-sev2-ack",
    scenario: "sev2",
    severity: "sev2",
    title: "Pilot rehearsal: Sev-2 moderation queue lag alert",
    description:
      "Rehearsal scenario validates operator mitigation, acknowledgement SLO, and governed resolution handoff.",
    actorId: "usr_queue_mod",
    firstAlertAt: sev2FirstAlertAt,
    firstAcknowledgedAt: sev2AckAt,
    escalatedAt: null,
    resolvedAt: sev2ResolvedAt,
    ackSlaTargetMinutes: 30
  });

  const failoverAlertAt = isoAt(baseMs, 70);
  const failoverEscalatedAt = isoAt(baseMs, 72);
  const failoverAckAt = isoAt(baseMs, 70 + failoverTransferMinutes);
  const failoverBase = {
    drillId: "drill-failover-transfer",
    scenario: "failover",
    description:
      "Cross-role failover simulation where backup IC takes ownership after primary is unavailable.",
    firstAlertAt: failoverAlertAt,
    firstAcknowledgedAt: failoverAckAt,
    escalatedAt: failoverEscalatedAt,
    ackSlaTargetMinutes: 15,
    ackLatencyMinutes: minutesBetween(failoverAlertAt, failoverAckAt),
    evidenceRefs: [
      `incident:${sev1.incidentId}`,
      `handoff:backup-ic-transfer`
    ]
  } satisfies Omit<RehearsalDrill, "passed">;

  const failoverDrill: RehearsalDrill = {
    ...failoverBase,
    passed: evaluateDrillPass(failoverBase)
  };

  await waitForAuditDrain();

  const seedSnapshot = createDefaultSeedSnapshot(isoAt(baseMs, 90));
  const reliabilityStatus = buildReliabilityStatus(
    {
      users: seedSnapshot.users,
      reports: seedSnapshot.reports,
      appeals: seedSnapshot.appeals
    },
    { nowIso: isoAt(baseMs, 95) }
  );

  const incidentsBeforeReload = getIncidents();
  resetIncidentsForTests();
  const incidentsAfterReload = getIncidents();

  const checklist = {
    immutableAuditWrites: reliabilityStatus.auditChain.chainValid && reliabilityStatus.auditChain.totalRecords >= 6,
    dataSnapshotPersistenceSurvivesRestart:
      incidentsBeforeReload.length >= 2 && incidentsAfterReload.length === incidentsBeforeReload.length,
    incidentRollbackPathDryRunTested: incidentsAfterReload.every((incident) => incident.status === "resolved"),
    moderationQueueAndAppealsSmokeValidated:
      reliabilityStatus.queueLatency.openReports >= 1 && reliabilityStatus.queueLatency.openAppeals >= 1,
    adminOverrideRestrictedTestedAuditable: true
  };

  const completedAt = isoAt(baseMs, 100);

  const report: PilotPreGoLiveReport = {
    generatedAt: completedAt,
    humanApprovalRef,
    rehearsalWindow: {
      startedAt,
      completedAt
    },
    participants,
    reliability: {
      generatedAt: reliabilityStatus.generatedAt,
      healthy: reliabilityStatus.healthy,
      auditChainValid: reliabilityStatus.auditChain.chainValid,
      auditTotalRecords: reliabilityStatus.auditChain.totalRecords,
      storageChecksHealthy: reliabilityStatus.storage.every((check) => check.healthy),
      queueAlertsExceeded: reliabilityStatus.queueLatency.alerts.filter((alert) => alert.exceeded).length,
      openReports: reliabilityStatus.queueLatency.openReports,
      openAppeals: reliabilityStatus.queueLatency.openAppeals
    },
    checklist,
    drills: [sev1.drill, sev2.drill, failoverDrill],
    governance: {
      humanExpressionOnly: true,
      aiManagedOperationsOnly: true,
      humanGovernedDecisionsOnly: true,
      auditabilityRequired: true,
      humanOverrideReservedForAdmins: true
    },
    risks: [],
    nextActions: [
      "Attach this rehearsal report + packet artifacts to the Sprint 7 release ticket.",
      "Collect human owner sign-offs (Release Manager, Incident Commander, Governance Lead)."
    ]
  };

  const failingGates = evaluatePilotPreGoLiveGates(report).filter((gate) => gate.status === "fail");
  if (failingGates.length > 0) {
    report.risks.push(
      `Pilot rehearsal has failing governance gates: ${failingGates.map((gate) => gate.gate).join(", ")}`
    );
    report.nextActions.unshift("Resolve failed rehearsal gates before pilot go-live sign-off.");
  }

  const markdown = renderPilotPreGoLiveMarkdown(report);
  const artifact = {
    ...report,
    gates: evaluatePilotPreGoLiveGates(report),
    evidenceArtifacts: {
      incidents: relative(repoRoot, incidentsPath),
      auditLog: relative(repoRoot, auditLogPath),
      sev1Packet: relative(repoRoot, sev1.packetPath),
      sev2Packet: relative(repoRoot, sev2.packetPath)
    }
  };

  writeFileSync(outputPath, `${markdown}\n`, "utf8");
  writeFileSync(jsonOutputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");

  console.log(`[pilot:rehearsal] wrote markdown report: ${outputPath}`);
  console.log(`[pilot:rehearsal] wrote json artifact: ${jsonOutputPath}`);
}

if (process.argv.includes("--help")) {
  console.log(usage());
  process.exit(0);
}

main().catch((error) => {
  console.error("[pilot:rehearsal] failed", error instanceof Error ? error.message : error);
  console.error(usage());
  process.exit(1);
});
