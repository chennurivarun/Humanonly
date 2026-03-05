# Sprint Checklist

## Sprint 1 — MVP Foundation

- [x] Setup runnable Next.js app in `apps/web`
- [x] Implement auth scaffold (Auth.js)
- [x] Create post API endpoint
- [x] Build feed endpoint (latest + cursor pagination)
- [x] Add report endpoint + moderation queue API
- [x] Add immutable audit writer for enforcement-sensitive actions
- [x] Human override control (admin-only)
- [x] Seed script + local dev docs
- [x] Basic UI for create post / feed / report
- [x] Add smoke tests for core flows

## Latest run summary (Sprint 7 — HumanOnly autopilot continuation, 2026-03-05 20:22 IST)
- ✅ Re-validated Sprint 1 MVP baseline on trunk: runnable Next.js scaffold in `apps/web`, MVP APIs (`/api/posts`, `/api/feed`, `/api/reports`), and immutable audit stubs in enforcement-sensitive flows.
- ✅ Executed full local verification suite clean: `npm run typecheck`, `npm run test`, `npm run build`.
- ✅ Refreshed roadmap/checklist trackers to log this continuation while preserving Sprint 7 final governance closeout as the only remaining unchecked phase.
- ⚠️ Remaining blocker unchanged: rotate `HUMANONLY_MANAGED_POSTGRES_URL` to the final external managed endpoint, rerun cadence, and collect explicit human owner sign-offs.

## Latest run summary (Sprint 7 — HumanOnly autopilot continuation, 2026-03-05 18:22 IST)
- ✅ Re-validated Sprint 1 MVP baseline on trunk: runnable Next.js scaffold in `apps/web`, MVP APIs (`/api/posts`, `/api/feed`, `/api/reports`), and immutable audit stubs in enforcement-sensitive flows.
- ✅ Executed full local verification suite clean: `npm run typecheck`, `npm run test`, `npm run build`.
- ✅ Refreshed roadmap/checklist trackers to log this continuation while preserving Sprint 7 final governance closeout as the only remaining unchecked phase.
- ⚠️ Remaining blocker unchanged: rotate `HUMANONLY_MANAGED_POSTGRES_URL` to the final external managed endpoint, rerun cadence, and collect explicit human owner sign-offs.

## Latest run summary (Sprint 7 — closeout status automation + sign-off outreach drafts, 2026-03-05 16:26 IST)
- ✅ Added governed closeout domain module for deterministic go-live status evaluation, blocker extraction, owner sign-off normalization, and decision guardrails (`apps/web/src/lib/go-live-closeout.ts`).
- ✅ Added regression coverage for blocked/ready decision paths, outreach draft generation, and governance enforcement against premature approval (`apps/web/src/lib/go-live-closeout.test.ts`).
- ✅ Added `npm run go-live:closeout` CLI + workflow integration to auto-generate closeout markdown/JSON artifacts in cadence runs (`apps/web/scripts/go-live-closeout.ts`, `.github/workflows/release-governance-cadence.yml`, `docs/SPRINT_7_GO_LIVE_CLOSEOUT_REPORT.md`, `docs/SPRINT_7_GO_LIVE_CLOSEOUT_REPORT.json`).
- ✅ Updated roadmap/local docs/go-live checklist with the new deterministic closeout automation path (`ROADMAP.md`, `docs/ROADMAP.md`, `docs/LOCAL_DEVELOPMENT.md`, `docs/SPRINT_7_GO_LIVE_CLOSEOUT.md`).
- ✅ Executed full local verification suite clean: `npm run typecheck`, `npm run test`, `npm run build`.
- ⚠️ Remaining blocker unchanged: rotate `HUMANONLY_MANAGED_POSTGRES_URL` to the final external managed endpoint and collect explicit human owner sign-offs.

## Latest run summary (Sprint 7 — HumanOnly autopilot continuation, 2026-03-05 16:22 IST)
- ✅ Re-verified Sprint 1 MVP baseline on trunk: runnable Next.js scaffold in `apps/web`, MVP APIs (`/api/posts`, `/api/feed`, `/api/reports`), and immutable audit stubs in enforcement-sensitive flows.
- ✅ Executed full local verification suite clean: `npm run typecheck`, `npm run test`, `npm run build`.
- ✅ Refreshed roadmap/checklist trackers to record this continuation while keeping Sprint 7 final governance closeout as the only remaining unchecked phase.
- ⚠️ Remaining blocker unchanged: rotate `HUMANONLY_MANAGED_POSTGRES_URL` to the final external managed endpoint, rerun cadence, and collect explicit human owner sign-offs.

## Latest run summary (Sprint 7 — governance closeout automation + sign-off gating, 2026-03-05 14:40 IST)
- ✅ Added managed-endpoint governance assessment + go-live readiness gate evaluation to release evidence domain (`apps/web/src/lib/release-governance-evidence.ts`).
- ✅ Added regression coverage for endpoint classification, sign-off readiness gating, and markdown rendering updates (`apps/web/src/lib/release-governance-evidence.test.ts`).
- ✅ Extended release evidence bundle generator to emit both markdown + JSON artifacts, parse explicit role sign-offs, and redact managed endpoint credentials before persistence (`apps/web/scripts/release-evidence-bundle.ts`).
- ✅ Updated cadence workflow to pass managed endpoint source metadata and upload JSON evidence artifact (`.github/workflows/release-governance-cadence.yml`).
- ✅ Refreshed Sprint 7 release evidence + closeout docs to reflect new governance gates and explicit sign-off capture flow (`docs/SPRINT_7_RELEASE_EVIDENCE_BUNDLE.md`, `docs/SPRINT_7_RELEASE_EVIDENCE_BUNDLE.json`, `docs/SPRINT_7_GO_LIVE_CLOSEOUT.md`, `docs/LOCAL_DEVELOPMENT.md`).
- ✅ Executed full local verification suite clean: `npm run typecheck`, `npm run test`, `npm run build`.
- ⚠️ Remaining blocker: rotate `HUMANONLY_MANAGED_POSTGRES_URL` to final external endpoint, rerun cadence, and collect explicit human owner approvals.

## Latest run summary (Sprint 7 — governance closeout prep + baseline revalidation, 2026-03-05 14:22 IST)
- ✅ Re-validated MVP baseline on trunk: runnable Next.js scaffold (`apps/web`), MVP APIs (`/api/posts`, `/api/feed`, `/api/reports`), and immutable audit stubs in enforcement-sensitive flows.
- ✅ Executed full local verification suite clean: `npm run typecheck`, `npm run test`, `npm run build`.
- ✅ Added final go-live governance closeout checklist with explicit human-owned actions and sign-off matrix (`docs/SPRINT_7_GO_LIVE_CLOSEOUT.md`).
- ⚠️ Remaining blocker unchanged: rotate `HUMANONLY_MANAGED_POSTGRES_URL` to final external endpoint and collect explicit human owner sign-offs.

## Latest run summary (Sprint 7 — managed cadence secret-backed execution + artifact hardening, 2026-03-05)
- ✅ Fixed a governance-critical artifact sanitization bug so managed validation reports never retain raw PostgreSQL credentials (`apps/web/src/lib/postgres-incremental-benchmark.ts`, `apps/web/src/lib/postgres-incremental-benchmark.test.ts`).
- ✅ Configured repository secret `HUMANONLY_MANAGED_POSTGRES_URL` and executed release-governance cadence without `postgres_url` override (`https://github.com/chennurivarun/Humanonly/actions/runs/22706417635`).
- ✅ Captured audit trail for one failed dispatch caused by malformed secret payload (`#22706372131`), then corrected secret wiring and reran successfully (`#22706417635`).
- ✅ Refreshed Sprint 6/7 governance evidence docs from the successful secret-backed cadence artifacts (`docs/SPRINT_6_MANAGED_POSTGRES_INCREMENTAL_VALIDATION.md`, `docs/SPRINT_7_RELEASE_EVIDENCE_BUNDLE.md`).
- ⚠️ Residual production risk: secret currently points to GitHub Actions localhost service for cadence simulation; rotate to final external managed endpoint before launch.

## Latest run summary (Sprint 7 — HumanOnly autopilot phase continuation, 2026-03-05 12:22 IST)
- ✅ Re-validated Sprint 1 MVP baseline on trunk: runnable Next.js scaffold in `apps/web`, MVP APIs (`/api/posts`, `/api/feed`, `/api/reports`), and immutable audit stubs in enforcement-sensitive flows.
- ✅ Executed local verification suite clean: `npm run typecheck`, `npm run test`, `npm run build`.
- ✅ Refreshed roadmap/checklist trackers to log this continuation and preserve Sprint 7 final governance gate focus.
- ⚠️ Remaining gate unchanged: configure `HUMANONLY_MANAGED_POSTGRES_URL` and run release-governance cadence against designated managed endpoint.

## Latest run summary (Sprint 7 — pre-go-live rehearsal evidence capture, 2026-03-05)
- ✅ Delivered deterministic pre-go-live rehearsal automation that executes governed Sev-1/Sev-2/failover acknowledgement drills, exports incident packet artifacts, and renders governance gate outcomes (`apps/web/scripts/pre-go-live-rehearsal.ts`, `apps/web/src/lib/pilot-rehearsal-evidence.ts`).
- ✅ Added regression coverage for rehearsal timing math, gate evaluation, and markdown rendering (`apps/web/src/lib/pilot-rehearsal-evidence.test.ts`).
- ✅ Executed rehearsal run with explicit human approval reference and published Sprint 7 report artifact (`npm run pilot:rehearsal -- --execute --human-approval-ref=CHANGE-2026-03-05-PRE-GO-LIVE`, `docs/SPRINT_7_PRE_GO_LIVE_REHEARSAL_REPORT.md`).
- ⚠️ Remaining gate: managed-endpoint cadence rerun still pending until `HUMANONLY_MANAGED_POSTGRES_URL` secret is designated (dispatch run `#22703213363` failed during target resolution because secret is unset).

## Latest run summary (Sprint 7 — HumanOnly autopilot phase continuation, 2026-03-05)
- ✅ Re-validated Sprint 1 MVP baseline on current trunk: runnable Next.js app scaffold in `apps/web`, MVP APIs (`/api/posts`, `/api/feed`, `/api/reports`), and audit stubs in enforcement-sensitive flows.
- ✅ Executed verification suite end-to-end: `npm run typecheck`, `npm run test`, and `npm run build` (all passing).
- ✅ Refreshed roadmap/checklist trackers to record this autopilot continuation and preserve focus on remaining Sprint 7 governance gates.
- ⚠️ Remaining execution gates unchanged: managed-endpoint cadence rerun using designated `HUMANONLY_MANAGED_POSTGRES_URL` secret, then pre-go-live rehearsal evidence capture.

## Latest run summary (Sprint 7 — cadence execution evidence archive)
- ✅ Executed release-governance cadence workflow in managed profile with explicit human approval reference (`CHANGE-2026-03-04-RELEASE-CADENCE`) and captured run metadata (`https://github.com/chennurivarun/Humanonly/actions/runs/22682903331`).
- ✅ Archived cadence artifact URL + approval reference into the release evidence bundle (`docs/SPRINT_7_RELEASE_EVIDENCE_BUNDLE.md`, artifact `https://github.com/chennurivarun/Humanonly/actions/runs/22682903331/artifacts/5765319499`).
- ✅ Refreshed managed-profile incremental validation report from cadence artifacts (`docs/SPRINT_6_MANAGED_POSTGRES_INCREMENTAL_VALIDATION.md`).
- ⚠️ Remaining gate: designate `HUMANONLY_MANAGED_POSTGRES_URL` secret and re-run cadence without URL override to close managed-endpoint sign-off.

## Latest run summary (Sprint 7 — release-ticket evidence bundle template + generator)
- ✅ Added a typed release evidence domain with explicit governance-gate evaluation and deterministic markdown rendering for release sign-off packets (`apps/web/src/lib/release-governance-evidence.ts`).
- ✅ Added regression coverage for gate evaluation, artifact rendering, and owner fallback handling (`apps/web/src/lib/release-governance-evidence.test.ts`).
- ✅ Added governed bundle generation CLI for release cadence artifacts (`npm run release:evidence:bundle`, `apps/web/scripts/release-evidence-bundle.ts`).
- ✅ Extended release-governance cadence workflow with target-profile resolution (`ephemeral|managed`) and automated evidence bundle generation (`.github/workflows/release-governance-cadence.yml`).
- ✅ Published Sprint 7 evidence bundle template and updated operator docs (`docs/SPRINT_7_RELEASE_EVIDENCE_BUNDLE.md`, `docs/LOCAL_DEVELOPMENT.md`, `README.md`).

## Latest run summary (Sprint 7 kickoff — MVP baseline revalidation + pre-go-live sequencing)
- ✅ Re-validated that the MVP baseline remains in-place on trunk: runnable Next.js app scaffold in `apps/web`, MVP APIs (`/api/posts`, `/api/feed`, `/api/reports`), and immutable audit stubs on enforcement-sensitive flows.
- ✅ Transitioned tracker state from Sprint 6 active to Sprint 7 active and captured pre-go-live priorities in roadmap/checklist docs (`ROADMAP.md`, `docs/ROADMAP.md`, `docs/SPRINT_CHECKLIST.md`).
- ✅ Updated immediate next actions to focus on managed-endpoint cadence evidence + release sign-off packaging.

## Latest run summary (Sprint 6 — Postgres production pooling + governed cutover automation)
- ✅ Finalized production-ready Postgres pool policy (size/timeouts/max-uses/TLS mode) with explicit production guardrail: `ssl=disable` requires human approval flag, otherwise runtime forces `ssl=require` (`apps/web/src/lib/storage/postgres-pool.ts`, `apps/web/src/lib/postgres-pool.test.ts`).
- ✅ Updated `PostgresStorageAdapter` to consume resolved pool policy and added explicit `close()` lifecycle for script-safe operations (`apps/web/src/lib/storage/postgres.ts`).
- ✅ Delivered governed SQLite→Postgres cutover automation with deterministic plan/apply/verify JSON evidence and explicit human approval gate for write actions (`apps/web/scripts/postgres-cutover.ts`, `scripts/db-migrate-sqlite-to-postgres.sh`).
- ✅ Added parity/integrity helper domain + regression tests for deterministic fingerprinting and FK reference checks (`apps/web/src/lib/postgres-cutover.ts`, `apps/web/src/lib/postgres-cutover.test.ts`).
- ✅ Updated deployment/local docs for finalized pooling defaults and cutover sequencing (`infra/postgres/deployment.md`, `docs/LOCAL_DEVELOPMENT.md`, `README.md`).

## Latest run summary (Sprint 6 — PostgreSQL incremental persistence optimization)
- ✅ Optimized `PostgresStorageAdapter.flush()` to use incremental diffs after initial baseline flush (only changed/new rows upserted, removed IDs deleted), avoiding full-snapshot write churn on every request (`apps/web/src/lib/storage/postgres.ts`).
- ✅ Preserved FK-safe ordering and transactional guarantees while reducing write amplification in sustained load scenarios.
- ✅ Added focused regression tests for incremental behavior and no-op flushes (`apps/web/src/lib/storage/postgres.test.ts`).

## Latest run summary (Sprint 4 — Incident Packet + Postgres CI)
- ✅ Added governance-ready incident packet export domain + endpoint (`apps/web/src/lib/incident/packet.ts`, `apps/web/src/app/api/admin/incident/[incidentId]/packet/route.ts`).
- ✅ Packet payload now includes lifecycle timeline, immutable audit references, and governance rationale assertions.
- ✅ Expanded admin monochrome incident controls with one-click packet export (`apps/web/src/app/page.tsx`).
- ✅ Added coverage for packet construction behavior (`apps/web/src/lib/incident/packet.test.ts`).
- ✅ Delivered real Postgres CI validation: service-container workflow + gated e2e adapter test (`.github/workflows/ci.yml`, `apps/web/src/lib/storage/postgres.e2e.test.ts`).
- ✅ Added automated on-call escalation drill cadence with acknowledgement SLO tracking + evidence template (`docs/SPRINT_3_PILOT_RUNBOOK.md`).
- ✅ Validation clean: typecheck clean, all tests passing, production build successful.

## Latest run summary (Sprint 6 — periodic Postgres full-reconcile drift guardrail)
- ✅ Added optional periodic full-reconcile cadence for PostgreSQL adapter via `HUMANONLY_POSTGRES_FULL_RECONCILE_EVERY_N_FLUSHES` to trigger deterministic full-sync passes on configured flush intervals (`apps/web/src/lib/storage/postgres.ts`).
- ✅ Added explicit reconcile entrypoint (`adapter.reconcileFull`) and regression coverage for manual + interval-triggered reconcile behavior (`apps/web/src/lib/storage/postgres.test.ts`).
- ✅ Added governed reconcile runner script for production maintenance windows with explicit human approval ref and audit report artifact output (`apps/web/scripts/postgres-full-reconcile.ts`, `npm run db:reconcile:postgres`).

## Latest run summary (Sprint 6 — managed-profile incremental persistence validation)
- ✅ Delivered managed-profile incremental validation harness with explicit governance execution gates (`--execute`, `--human-approval-ref`) and deterministic evidence artifacts (`apps/web/scripts/perf-postgres-incremental-managed.ts`, `npm run perf:postgres-managed`).
- ✅ Added reusable benchmark reporting domain + regression tests for scenario summarization, delta math, URL redaction, and markdown rendering (`apps/web/src/lib/postgres-incremental-benchmark.ts`, `apps/web/src/lib/postgres-incremental-benchmark.test.ts`).
- ✅ Executed validation run under production-like pool policy + simulated RTT and published benchmark evidence (`docs/SPRINT_6_MANAGED_POSTGRES_INCREMENTAL_VALIDATION.md`).
- ✅ Observed sustained incremental gains versus forced full reconcile on identical mutation workload (avg latency -99.2%, p95 -98.9%, mutating SQL -99.5%).

## Latest run summary (Sprint 6 — release governance automation cadence)
- ✅ Added scheduled/manual release governance workflow that seeds baseline data, runs governed cutover `plan/apply/verify`, runs managed-profile incremental validation, and uploads deterministic JSON evidence artifacts (`.github/workflows/release-governance-cadence.yml`).
- ✅ Wired workflow dispatch inputs for explicit approval references and managed-latency simulation while preserving weekly scheduled cadence.
- ✅ Updated roadmap trackers to close the final Sprint 6 unfinished milestone (`ROADMAP.md`, `docs/ROADMAP.md`).

## Next actions
1. Rotate `HUMANONLY_MANAGED_POSTGRES_URL` to the final external managed endpoint (instead of GitHub-hosted localhost simulation) and re-run cadence for production launch evidence.
2. Attach Sprint 7 cadence + pre-go-live artifacts to the release ticket and collect owner sign-offs (Release Manager, Incident Commander, Platform Operator, Governance Lead) via `npm run release:evidence:bundle ... --signoff-manifest-json=your-manifest.json` (start from `docs/SPRINT_7_SIGNOFF_MANIFEST_TEMPLATE.json`; use per-role `--*-signoff` flags only for patch updates) so the manifest double-checks `pending|approved|rejected` statuses, ISO timestamps, approval references, and optional contact channels/notes.
3. Lock go-live decision only after explicit human approval on the release evidence bundle.

Progress: deterministic sign-off manifest intake + closeout automation now keeps the evidence bundle and outreach drafts in sync without implicit approvals; remaining blocker is the human-controlled endpoint rotation + explicit owner acknowledgments before closing the final gate.

## Latest run summary (Sprint 6 — storage backend live benchmark + audit policy lock)
- ✅ Extended backend comparison runner to auto-provision a live embedded PostgreSQL instance when `HUMANONLY_POSTGRES_URL` is not configured (`apps/web/scripts/perf-storage-backend-compare.ts`, `embedded-postgres`).
- ✅ Added shared benchmark reporting domain utilities + regression tests for compare math/report rendering (`apps/web/src/lib/storage-backend-benchmark.ts`, `apps/web/src/lib/storage-backend-benchmark.test.ts`).
- ✅ Executed live SQLite-vs-Postgres benchmark and published validated deltas/artifacts (`docs/SPRINT_6_STORAGE_BACKEND_BENCHMARK.md`).
- ✅ Locked production audit-mode governance policy in code: default remains `sync`; production `async` now requires explicit human approval flag `HUMANONLY_AUDIT_ASYNC_APPROVED=1` (+ optional approval reference) (`apps/web/src/lib/write-path.ts`, `apps/web/src/lib/write-path.test.ts`).
- ✅ Hardened Postgres persistence semantics by serializing adapter flushes with snapshot-at-invocation safety to prevent deadlocks under concurrent writes (`apps/web/src/lib/storage/postgres.ts`, `apps/web/src/lib/storage/postgres.test.ts`).

## Sprint 2 progress
- ✅ Added trust scoring v1 baseline domain model (`apps/web/src/lib/trust.ts`) with transparent rationale events.
- ✅ Added trust APIs: `GET /api/trust/me` (self) and `GET /api/trust/:userId` (moderator/admin).
- ✅ Added trust scoring tests for baseline and penalty/reward behavior (`apps/web/src/lib/trust.test.ts`).
- ✅ Added appeals APIs and adjudication flow (`/api/appeals`, `/api/appeals/:appealId/decision`).
- ✅ Added immutable moderation action-log API (`/api/moderation/action-log`).
- ✅ Added admin metrics API + dashboard panel (`/api/admin/metrics`) for reports, appeals, trust distribution, and override rates.
- ✅ Added role-aware moderation insights API + UI surfaces with trend analytics (`/api/moderation/insights`, `src/app/page.tsx`).

## Latest run summary (Sprint 5 — enhanced moderation tooling)
- ✅ Added a moderation cockpit domain with priority scoring, trust-risk tiering, SLA calculations, and filter support (`apps/web/src/lib/moderation/cockpit.ts`).
- ✅ Added role-gated cockpit API (`GET /api/moderation/cockpit`) with immutable audit logging for filter + SLA observability (`apps/web/src/app/api/moderation/cockpit/route.ts`).
- ✅ Added audited moderation handoff workflow (`POST /api/moderation/handoff`) with explicit human confirmation and template-governed actions (`apps/web/src/lib/moderation/handoff.ts`, `apps/web/src/app/api/moderation/handoff/route.ts`).
- ✅ Expanded monochrome moderator UI with moderation cockpit filters, SLA view, and one-click handoff controls (`apps/web/src/app/page.tsx`).
- ✅ Extended moderation audit coverage to include cockpit reads + handoff events (`apps/web/src/lib/audit.ts`, `apps/web/src/lib/moderation/action-log.ts`).
- ✅ Added automated test coverage for cockpit ranking/SLA logic and handoff validation/state transitions (`apps/web/src/lib/moderation-cockpit.test.ts`, `apps/web/src/lib/moderation-handoff.test.ts`).
- ✅ Validation clean: typecheck passing, tests passing, production build passing.

## Latest run summary (Sprint 5 — scale-out performance)
- ✅ Added repeatable performance harness for `POST /api/posts`, `GET /api/feed`, and `POST /api/reports` with deterministic seed reset + tiered concurrency (`apps/web/scripts/perf-harness.ts`).
- ✅ Added runnable workspace/app scripts for harness execution (`package.json`, `apps/web/package.json`).
- ✅ Executed baseline/sustained/pressure profiles with zero failures and published metrics + bottleneck analysis (`docs/SPRINT_5_SCALE_OUT_PERFORMANCE_REPORT.md`).
- ✅ Updated roadmap + sprint tracking to mark Sprint 5 scale-out milestone complete.

## Latest run summary (Sprint 6 — write-path optimization kickoff)
- ✅ Added phase-level write-path timings (validation/domain/persist/audit + total) for post/report write APIs (`apps/web/src/lib/write-path.ts`, `apps/web/src/app/api/posts/route.ts`, `apps/web/src/app/api/reports/route.ts`).
- ✅ Refactored content write domain helpers to isolate domain mutation from persistence, enabling explicit persist-phase measurement (`apps/web/src/lib/content.ts`).
- ✅ Added async-safe audit write mode toggle (`HUMANONLY_AUDIT_WRITE_MODE=async`) to decouple request latency from audit fs writes during pressure tests.
- ✅ Updated roadmap + sprint checklist to mark Sprint 6 kickoff complete and track remaining sync-vs-async benchmark work.

## Latest run summary (Sprint 6 — sync vs async audit benchmark)
- ✅ Extended the perf harness with explicit audit-mode execution, JSON export support, and queue-drain correctness for fire-and-forget audit writes (`apps/web/scripts/perf-harness.ts`, `apps/web/src/lib/audit.ts`).
- ✅ Added cross-mode compare automation that runs sync+async harness passes and publishes delta tables as JSON/Markdown artifacts (`apps/web/scripts/perf-audit-mode-compare.ts`, `package.json`, `apps/web/package.json`).
- ✅ Added regression coverage for queued async audit flushing (`apps/web/src/lib/audit.test.ts`).
- ✅ Executed sync-vs-async benchmark under baseline/sustained/pressure load and published reproducible results with governance guardrails (`docs/SPRINT_6_AUDIT_MODE_BENCHMARK.md`).

## Sprint 7 checklist
- [x] Re-verify MVP baseline readiness (runnable Next.js app + posts/feed/reports APIs + audit stubs)
- [x] Publish release-ticket evidence bundle template + generation tooling
- [x] Execute release-governance cadence against designated managed Postgres target (secret-backed managed-profile run `#22706417635` completed without `postgres_url` override; evidence archived in `docs/SPRINT_7_RELEASE_EVIDENCE_BUNDLE.md`)
- [x] Archive cadence artifact URLs + approval refs in release ticket evidence bundle
- [x] Complete pre-go-live rehearsal using Sprint 3 runbook and record incident/escalation timing evidence (`docs/SPRINT_7_PRE_GO_LIVE_REHEARSAL_REPORT.md`)
- [ ] Final go-live governance closeout: rotate managed cadence secret to the final external endpoint, rerun cadence, and collect explicit human owner sign-offs on `docs/SPRINT_7_RELEASE_EVIDENCE_BUNDLE.md`

## Sprint 6 checklist
- [x] Plan Sprint 6 write-path optimization follow-through scope
- [x] Add phase-level write-path instrumentation (validation/domain/persist/audit) to post/report writes
- [x] Add async-safe audit write mode toggle
- [x] Run sustained + pressure benchmark comparing `HUMANONLY_AUDIT_WRITE_MODE=sync` vs `async` and publish deltas
- [x] Add SQLite-vs-Postgres harness comparison automation + report scaffold
- [x] Execute SQLite-vs-Postgres benchmark with live PostgreSQL and publish validated deltas
- [x] Decide default production audit mode policy with rollout/rollback guardrails
- [x] Finalize multi-instance Postgres pooling defaults and enforce production TLS guardrails
- [x] Deliver governed SQLite→Postgres cutover automation (plan/apply/verify + deterministic evidence reports)
- [x] Validate incremental persistence behavior under managed-production profile (pool policy + RTT simulation) and publish benchmark evidence (`npm run perf:postgres-managed`, `docs/SPRINT_6_MANAGED_POSTGRES_INCREMENTAL_VALIDATION.md`)
- [x] Add optional periodic full-reconcile job for long-lived multi-writer Postgres drift detection

## Sprint 5 checklist
- [x] Define next features for phase 5 (scoped in `ROADMAP.md`)
- [x] Implement enhanced moderation tooling (priority queue + SLA view + action handoffs)
- [x] Run scale-out performance testing and publish bottleneck report
