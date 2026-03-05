# Sprint 7 Final Go-Live Governance Closeout

Status: **In progress (human approvals pending)**
Updated: 2026-03-05 14:22 IST

## Objective
Close the final Sprint 7 governance gate by rotating the managed Postgres cadence secret to the final external endpoint, re-running release cadence, and collecting explicit human sign-offs.

## Preconditions
- Managed endpoint owner has confirmed production-ready connection details.
- `HUMANONLY_MANAGED_POSTGRES_URL` secret can be rotated by an authorized human operator.
- Human approval reference for cadence execution is issued (change ticket / approval ID).

## Execution checklist
- [ ] Rotate `HUMANONLY_MANAGED_POSTGRES_URL` to final external managed endpoint (human action).
- [ ] Trigger release-governance cadence run in `managed` profile without URL override.
- [ ] Archive new run URL + artifact URL in `docs/SPRINT_7_RELEASE_EVIDENCE_BUNDLE.md`.
- [ ] Verify all governance gates are PASS in regenerated bundle.
- [ ] Collect explicit sign-offs from required owners in evidence bundle.
- [ ] Record final go-live decision with approval reference.

## Required owner sign-offs
| Role | Owner | Sign-off | Timestamp |
|---|---|---|---|
| Release Manager | TBD | ☐ | — |
| Incident Commander | TBD | ☐ | — |
| Platform Operator | TBD | ☐ | — |
| Governance Lead | TBD | ☐ | — |

## Verification snapshot (2026-03-05 14:22 IST)
- Local baseline revalidated: `npm run typecheck && npm run test && npm run build` ✅
- MVP baseline still intact on trunk:
  - Runnable Next.js app in `apps/web` ✅
  - MVP APIs: `/api/posts`, `/api/feed`, `/api/reports` ✅
  - Immutable audit stubs active in enforcement-sensitive flows ✅

## Current blocker
Final external managed endpoint rotation + owner sign-offs require explicit human action/approval and are not auto-executed by autopilot.
