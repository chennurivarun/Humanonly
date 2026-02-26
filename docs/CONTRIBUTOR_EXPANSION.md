# Community Contributor Expansion Plan (Sprint 3)

This guide makes HumanOnly easier for first-time contributors while keeping governance controls explicit.

## Goals
- Reduce first PR time to <45 minutes for docs/tests-only contributions.
- Make review expectations predictable.
- Keep safety and audit constraints visible in every contribution path.

## Contribution Paths

### 1) First Contribution (Docs / Tests)
- Pick issues labelled `good first issue`.
- Keep PRs under ~250 changed lines.
- Include before/after behavior in PR description.

### 2) Product Contribution (API/UI)
- Link to a roadmap item or issue.
- Add or update tests with every behavior change.
- If touching enforcement-sensitive paths, include audit impact in the PR template checklist.

### 3) Governance Contribution
- Changes to manifesto/governance/security documents require explicit maintainer approval.
- Add rationale section and migration impact when modifying policy semantics.

## Onboarding Checklist
1. Fork + clone repository.
2. Run `npm install` and `npm run dev`.
3. Read `docs/LOCAL_DEVELOPMENT.md`, `docs/ARCHITECTURE.md`, and `SECURITY.md`.
4. Pick one issue with labels: `good first issue` or `help wanted`.
5. Open PR with completed template and linked issue.

## Maintainer Triage Standards
- `good first issue`: bounded scope, clear acceptance criteria, no schema migration.
- `help wanted`: medium scope, touches multiple files but not governance-critical surfaces.
- `governance`: requires design discussion before implementation.

## Review SLA (Target)
- First response on new PRs: within 48 hours.
- Follow-up review: within 24 hours of contributor updates.
- Keep feedback actionable and grouped by must-fix vs optional.

## Contributor Recognition
- Add merged contributor handles to release notes when sprint closes.
- Tag meaningful first contributions in changelog highlights.

## Done Criteria
- CONTRIBUTING updated with clear tracks and quality bar.
- Local development + architecture links surfaced in onboarding flow.
- Sprint roadmap/checklist updated to reflect completion.
