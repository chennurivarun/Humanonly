# Sprint 7 Release Governance Evidence Bundle

Generated: TEMPLATE

## Cadence run metadata
- Run ID: `TBD`
- Run URL: TBD
- Target profile: `managed`
- Executed at: `TBD`
- Human approval reference: `TBD`

## Governance gate outcomes
| Gate | Status | Details |
|---|---|---|
| Governed cutover plan generated | TBD | action=plan |
| Governed cutover apply executed with human approval | TBD | approvalRef=TBD |
| Cutover parity verification | TBD | counts + fingerprint parity |
| Managed-profile incremental validation | TBD | latency + mutating query delta |

## Managed-profile validation deltas
- Avg latency delta (incremental vs full reconcile): TBD
- p95 latency delta (incremental vs full reconcile): TBD
- Avg mutating SQL delta (incremental vs full reconcile): TBD
- Simulated network latency per SQL round trip: TBD
- Validation PostgreSQL source: `managed`

## Required evidence artifacts
- Cutover plan evidence: `.tmp/release-cadence/cutover-plan.json`
- Cutover apply evidence: `.tmp/release-cadence/cutover-apply.json`
- Cutover verify evidence: `.tmp/release-cadence/cutover-verify.json`
- Managed incremental validation evidence: `.tmp/release-cadence/perf-postgres-managed.json`
- Managed incremental validation markdown: `docs/SPRINT_6_MANAGED_POSTGRES_INCREMENTAL_VALIDATION.md`

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
- TBD

## Next actions
1. Trigger cadence workflow on managed profile with approval reference.
2. Replace `TBD` values with run metadata + artifact URLs.
3. Attach this bundle to the release sign-off ticket.
