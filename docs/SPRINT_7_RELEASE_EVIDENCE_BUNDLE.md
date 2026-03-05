# Sprint 7 Release Governance Evidence Bundle

Generated: 2026-03-05T07:09:05.324Z

## Cadence run metadata
- Run ID: `22706417635`
- Run URL: https://github.com/chennurivarun/Humanonly/actions/runs/22706417635
- Target profile: `managed`
- Executed at: `2026-03-05T07:07:59Z`
- Human approval reference: `CHANGE-2026-03-05-MANAGED-SECRET-RUN-RETRY`

## Governance gate outcomes
| Gate | Status | Details |
|---|---|---|
| Governed cutover plan generated | PASS | action=plan, generatedAt=2026-03-05T07:04:34.563Z |
| Governed cutover apply executed with human approval | PASS | approvalRef=CHANGE-2026-03-05-MANAGED-SECRET-RUN-RETRY |
| Cutover parity verification | PASS | apply(counts=ok, fingerprint=ok); verify(counts=ok, fingerprint=ok) |
| Managed-profile incremental validation | PASS | avgLatencyDelta=-99.1%, mutatingQueryDelta=-99.5% |

## Managed-profile validation deltas
- Avg latency delta (incremental vs full reconcile): -99.1%
- p95 latency delta (incremental vs full reconcile): -98.8%
- Avg mutating SQL delta (incremental vs full reconcile): -99.5%
- Simulated network latency per SQL round trip: 12ms
- Validation PostgreSQL source: `cli`

## Required evidence artifacts
- Cadence artifact bundle: [release-governance-cadence-22706417635](https://github.com/chennurivarun/Humanonly/actions/runs/22706417635/artifacts/5774499356)
- Cutover plan evidence: [.tmp/release-cadence/cutover-plan.json](https://github.com/chennurivarun/Humanonly/actions/runs/22706417635/artifacts/5774499356)
- Cutover apply evidence: [.tmp/release-cadence/cutover-apply.json](https://github.com/chennurivarun/Humanonly/actions/runs/22706417635/artifacts/5774499356)
- Cutover verify evidence: [.tmp/release-cadence/cutover-verify.json](https://github.com/chennurivarun/Humanonly/actions/runs/22706417635/artifacts/5774499356)
- Managed incremental validation evidence: [.tmp/release-cadence/perf-postgres-managed.json](https://github.com/chennurivarun/Humanonly/actions/runs/22706417635/artifacts/5774499356)
- Managed incremental validation markdown: [docs/SPRINT_6_MANAGED_POSTGRES_INCREMENTAL_VALIDATION.md](https://github.com/chennurivarun/Humanonly/actions/runs/22706417635/artifacts/5774499356)

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
- HUMANONLY_MANAGED_POSTGRES_URL currently targets GitHub-hosted localhost service for cadence simulation; update secret to final external managed endpoint before production launch.

## Next actions
1. Rotate HUMANONLY_MANAGED_POSTGRES_URL to the final external managed endpoint and re-run cadence.
2. Collect owner sign-offs (Release Manager, Incident Commander, Platform Operator, Governance Lead) in this evidence bundle.

