# Sprint 7 Final Go-Live Governance Closeout

Status: **In progress (human approvals + final endpoint rotation pending)**
Updated: 2026-03-05 14:40 IST

## Objective
Close the final Sprint 7 governance gate by rotating the managed Postgres cadence secret to the final external endpoint, re-running release cadence, and collecting explicit human sign-offs.

## Preconditions
- Managed endpoint owner has confirmed production-ready connection details.
- `HUMANONLY_MANAGED_POSTGRES_URL` secret can be rotated by an authorized human operator.
- Human approval reference for cadence execution is issued (change ticket / approval ID).

## Execution checklist
- [ ] Rotate `HUMANONLY_MANAGED_POSTGRES_URL` to final external managed endpoint (human action).
- [ ] Trigger release-governance cadence run in `managed` profile without URL override.
- [ ] Regenerate release evidence bundle (`docs/SPRINT_7_RELEASE_EVIDENCE_BUNDLE.md` + `docs/SPRINT_7_RELEASE_EVIDENCE_BUNDLE.json`).
- [ ] Confirm `Managed Postgres endpoint rotated to external target` gate is PASS.
- [ ] Collect explicit sign-offs from required owners in evidence bundle (`--*-signoff=approved`, approval ref, timestamp).
- [ ] Confirm `Explicit human owner sign-offs` gate is PASS.
- [ ] Record final go-live decision with approval reference.

## Required owner sign-offs
| Role | Owner | Decision | Approval Ref | Timestamp |
|---|---|---|---|---|
| Release Manager | TBD | PENDING | — | — |
| Incident Commander | TBD | PENDING | — | — |
| Platform Operator | TBD | PENDING | — | — |
| Governance Lead | TBD | PENDING | — | — |

## Verification snapshot (2026-03-05 14:40 IST)
- Local baseline revalidated: `npm run typecheck && npm run test && npm run build` ✅
- MVP baseline still intact on trunk:
  - Runnable Next.js app in `apps/web` ✅
  - MVP APIs: `/api/posts`, `/api/feed`, `/api/reports` ✅
  - Immutable audit stubs active in enforcement-sensitive flows ✅
- Release evidence bundle now includes deterministic go-live readiness gates + endpoint classification + explicit sign-off matrix (`docs/SPRINT_7_RELEASE_EVIDENCE_BUNDLE.md`, `.json`) ✅

## Current blocker
Final external managed endpoint rotation + explicit human owner approvals are governance-controlled human actions and are intentionally not auto-approved by autopilot.
