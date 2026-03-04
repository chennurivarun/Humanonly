# Sprint 7 Release Governance Evidence Bundle

Generated: 2026-03-04T18:20:25.800Z

## Cadence run metadata
- Run ID: `22682903331`
- Run URL: https://github.com/chennurivarun/Humanonly/actions/runs/22682903331
- Target profile: `managed`
- Executed at: `2026-03-04T18:15:42Z`
- Human approval reference: `CHANGE-2026-03-04-RELEASE-CADENCE`

## Governance gate outcomes
| Gate | Status | Details |
|---|---|---|
| Governed cutover plan generated | PASS | action=plan, generatedAt=2026-03-04T18:16:20.657Z |
| Governed cutover apply executed with human approval | PASS | approvalRef=CHANGE-2026-03-04-RELEASE-CADENCE |
| Cutover parity verification | PASS | apply(counts=ok, fingerprint=ok); verify(counts=ok, fingerprint=ok) |
| Managed-profile incremental validation | PASS | avgLatencyDelta=-99.1%, mutatingQueryDelta=-99.5% |

## Managed-profile validation deltas
- Avg latency delta (incremental vs full reconcile): -99.1%
- p95 latency delta (incremental vs full reconcile): -98.9%
- Avg mutating SQL delta (incremental vs full reconcile): -99.5%
- Simulated network latency per SQL round trip: 12ms
- Validation PostgreSQL source: `cli`

## Required evidence artifacts
- Cadence artifact bundle: [release-governance-cadence-22682903331](https://github.com/chennurivarun/Humanonly/actions/runs/22682903331/artifacts/5765319499)
- Cutover plan evidence: [.tmp/release-cadence/cutover-plan.json](https://github.com/chennurivarun/Humanonly/actions/runs/22682903331/artifacts/5765319499)
- Cutover apply evidence: [.tmp/release-cadence/cutover-apply.json](https://github.com/chennurivarun/Humanonly/actions/runs/22682903331/artifacts/5765319499)
- Cutover verify evidence: [.tmp/release-cadence/cutover-verify.json](https://github.com/chennurivarun/Humanonly/actions/runs/22682903331/artifacts/5765319499)
- Managed incremental validation evidence: [.tmp/release-cadence/perf-postgres-managed.json](https://github.com/chennurivarun/Humanonly/actions/runs/22682903331/artifacts/5765319499)
- Managed incremental validation markdown: [docs/SPRINT_6_MANAGED_POSTGRES_INCREMENTAL_VALIDATION.md](https://github.com/chennurivarun/Humanonly/actions/runs/22682903331/artifacts/5765319499)

## Ownership + sign-off
| Role | Owner | Sign-off |
|---|---|---|
| Release Manager | TBD | ☐ |
| Incident Commander | TBD | ☐ |
| Platform Operator | TBD | ☐ |
| Governance Lead | TBD | ☐ |

## Governance assertions
- Human expression only
- AI-managed operations
- Human-governed decisions
- Auditability required
- Human override reserved for admins

## Risks
- Managed profile currently uses workflow input override (localhost service container); repo secret HUMANONLY_MANAGED_POSTGRES_URL is not configured yet.

## Next actions
1. Configure HUMANONLY_MANAGED_POSTGRES_URL secret for dedicated managed endpoint cadence runs.
2. Re-run cadence without postgres_url override and append refreshed artifact URL to this bundle.

