# Sprint 7 Final Go-Live Governance Closeout

Status: **In progress (human approvals + final endpoint rotation pending)**
Updated: 2026-03-05 22:35 IST

## Objective
Close the final Sprint 7 governance gate by rotating the managed Postgres cadence secret to the final external endpoint, re-running release cadence, and collecting explicit human sign-offs.

## Progress
- Sign-off metadata is now ingested from a deterministic manifest (`--signoff-manifest-json`) so release evidence + closeout tooling agree on decisions, ISO timestamps, contact channels, and notes without implicit approvals.
- Manifest bootstrap template added at `docs/SPRINT_7_SIGNOFF_MANIFEST_TEMPLATE.json` to standardize owner sign-off capture before ingestion.
- Managed endpoint readiness gate now enforces governed source evidence in addition to external host classification: cadence runs sourced from `workflow-input` remain blocked for production closeout until `repo-secret`/`env` evidence is used.
- Managed endpoint classifier hardened to reject protocol drift (`postgres://`/`postgresql://` only), reserved/private network ranges (including CGNAT + documentation blocks), and single-label/internal hostnames from satisfying production endpoint readiness.

## Preconditions
- Managed endpoint owner has confirmed production-ready connection details.
- `HUMANONLY_MANAGED_POSTGRES_URL` secret can be rotated by an authorized human operator.
- Human approval reference for cadence execution is issued (change ticket / approval ID).

## Execution checklist
- [ ] Rotate `HUMANONLY_MANAGED_POSTGRES_URL` to final external managed endpoint (human action).
- [ ] Trigger release-governance cadence run in `managed` profile without URL override.
- [ ] Regenerate release evidence bundle (`docs/SPRINT_7_RELEASE_EVIDENCE_BUNDLE.md` + `docs/SPRINT_7_RELEASE_EVIDENCE_BUNDLE.json`) using `--signoff-manifest-json` so the manifest that captures roles/contacts also seeds the provable evidence artifacts.
- [x] Generate deterministic closeout status report + sign-off outreach drafts (`npm run go-live:closeout`, `docs/SPRINT_7_GO_LIVE_CLOSEOUT_REPORT.md`, `docs/SPRINT_7_GO_LIVE_CLOSEOUT_REPORT.json`).
  Reuse the same manifest while generating the closeout report so the drafted outreach contacts stay aligned with the recorded decisions.
- [ ] Confirm `Managed Postgres endpoint rotated to external target` gate is PASS.
- [ ] Collect explicit sign-offs from required owners in evidence bundle (preferred: manifest from `docs/SPRINT_7_SIGNOFF_MANIFEST_TEMPLATE.json` + `--signoff-manifest-json`; fallback: per-role `--*-signoff` flags).
- [ ] Confirm `Explicit human owner sign-offs` gate is PASS.
- [ ] Record final go-live decision with approval reference.

## Required owner sign-offs
| Role | Owner | Decision | Approval Ref | Timestamp |
|---|---|---|---|---|
| Release Manager | TBD | PENDING | — | — |
| Incident Commander | TBD | PENDING | — | — |
| Platform Operator | TBD | PENDING | — | — |
| Governance Lead | TBD | PENDING | — | — |

## Verification snapshot (2026-03-05 22:35 IST)
- Local baseline revalidated: `npm run typecheck && npm run test && npm run build` ✅
- MVP baseline still intact on trunk:
  - Runnable Next.js app in `apps/web` ✅
  - MVP APIs: `/api/posts`, `/api/feed`, `/api/reports` ✅
  - Immutable audit stubs active in enforcement-sensitive flows ✅
- Release evidence bundle includes deterministic go-live readiness gates + endpoint classification + explicit sign-off matrix (`docs/SPRINT_7_RELEASE_EVIDENCE_BUNDLE.md`, `.json`) ✅
- Endpoint readiness guardrail now requires governed endpoint evidence source (`repo-secret`/`env`) in addition to external host classification; workflow override evidence remains blocked for production closeout (`apps/web/src/lib/release-governance-evidence.ts`) ✅
- Endpoint classifier now rejects non-Postgres protocols plus reserved/private/internal target classes (CGNAT/documentation ranges, internal suffixes, single-label hosts), preventing false-positive readiness on non-production endpoints (`apps/web/src/lib/release-governance-evidence.ts`, `apps/web/src/lib/release-governance-evidence.test.ts`) ✅
- Go-live closeout status report automation now emits blockers + draft sign-off outreach packets for explicit human review before sending (`docs/SPRINT_7_GO_LIVE_CLOSEOUT_REPORT.md`, `.json`) ✅
- Deterministic sign-off manifest parsing + template now enforce role completeness, ISO timestamps, approval references, and contact metadata handoff (`apps/web/src/lib/sign-off-intake.ts`, `docs/SPRINT_7_SIGNOFF_MANIFEST_TEMPLATE.json`) ✅

## Current blocker
Final external managed endpoint rotation + explicit human owner approvals are governance-controlled human actions and are intentionally not auto-approved by autopilot; the manifest only records their decisions so the evidence can be handed off audit-ready once those human actions conclude.
