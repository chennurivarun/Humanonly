# Sprint 3 Pilot Readiness Runbook

## Purpose
Operational checklist for launching the first HumanOnly pilot safely with human governance in control.

## Scope
Covers:
- Incident response flow
- Governance escalation path
- Shift operator checklist (preflight, during-shift, post-shift)
- Reliability controls required before and during pilot

Out of scope:
- Product roadmap features not tied to pilot safety/reliability
- Marketing/community launch plans

---

## 1) Roles and Responsibilities

### Incident Commander (IC)
- Owns incident timeline and severity classification.
- Coordinates moderator/admin actions.
- Approves external status updates (if required).

### Moderation Operator
- Monitors moderation queue health and appeals backlog.
- Executes approved moderation actions.
- Escalates ambiguous/high-risk cases to Governance Lead.

### Governance Lead (Admin)
- Final authority for policy interpretation and override use.
- Approves emergency override requests.
- Ensures every sensitive action has immutable audit evidence.

### Platform Operator
- Monitors service health (API latency/errors, storage health, audit write health).
- Executes rollback/recovery procedures.
- Confirms post-incident reliability checks.

---

## 2) Severity Model

### Sev-1 (Critical)
- Audit chain integrity failure, data loss risk, or unauthorized enforcement actions.
- Immediate actions:
  1. Freeze non-essential moderation actions.
  2. Assign IC.
  3. Preserve logs/snapshots.
  4. Initiate governance escalation within 10 minutes.

### Sev-2 (Major)
- Moderation queue unavailable/lagging; appeals flow blocked; persistent API failures.
- Immediate actions:
  1. Assign IC.
  2. Apply mitigation/rollback.
  3. Update governance lead every 30 minutes until stable.

### Sev-3 (Minor)
- Partial degradation with workarounds, non-critical dashboard/reporting issues.
- Immediate actions:
  1. File incident record.
  2. Mitigate in same shift.
  3. Include in end-of-day reliability review.

### Severity-to-Action Alert Routing Matrix

| Severity | Trigger examples | Primary owner | Notification route | Ack SLA | Escalation path |
| --- | --- | --- | --- | --- | --- |
| Sev-1 | Audit chain break, unauthorized enforcement action, data corruption risk | Incident Commander + Platform Operator | Immediate call + Telegram incident channel + incident record in app | 10 min | IC → Governance Lead (mandatory) → Founder/Exec sponsor if unresolved in 30 min |
| Sev-2 | Moderation queue blocked >15 min, appeals decision flow unavailable, sustained API 5xx spike | Platform Operator | Telegram incident channel + direct ping to on-call moderator/admin | 30 min | Platform Operator → Incident Commander → Governance Lead if impact extends >60 min |
| Sev-3 | Dashboard/reporting degradation, non-blocking reliability warning | Shift operator on duty | Shift handoff log + pilot ops channel | Same shift | Shift operator → Platform Operator (if unresolved by handoff) |

Routing rules:
1. Every Sev-1/Sev-2 alert must include incident ID, suspected blast radius, and current mitigation state.
2. Any alert that includes potential policy harm automatically adds Governance Lead to the page list.
3. If acknowledgement SLA is missed, escalate one level automatically and log the timestamped breach in the incident timeline.

### On-Call Contact Checklist

Maintain this checklist at shift start and after any roster change:
- [ ] Confirm primary + secondary Incident Commander contacts are current.
- [ ] Confirm primary + secondary Platform Operator contacts are current.
- [ ] Confirm Governance Lead escalation contact is reachable (backup contact listed).
- [ ] Confirm moderator on-call coverage window (start/end IST) is posted in shift notes.
- [ ] Confirm incident channel, fallback direct-call method, and timezone for each contact.
- [ ] Run one dry notification ping (non-urgent) and record acknowledgement latency.

Minimum contact card fields (store in private operator notes, not public docs):
- Name / role
- Preferred contact methods (priority order)
- Local timezone + active coverage window
- Backup contact
- Last verification timestamp

---

## 3) Governance Escalation Protocol

Escalate when any of the following are true:
- Permanent account/content action is disputed by moderator consensus.
- Emergency override is requested.
- Potential policy contradiction or high-impact false positive.
- Any event involving potential user harm or legal risk.

### Escalation Steps
1. Create incident note with: timestamp, actor, affected entities, proposed action.
2. Attach immutable audit references (action hash chain IDs where available) — use incident packet export (`GET /api/admin/incident/:incidentId/packet`) when possible.
3. Request Governance Lead decision with one of:
   - APPROVE action
   - APPROVE WITH CONDITIONS
   - REJECT and revert/hold
4. Record decision rationale in immutable audit stream via existing moderation endpoints.
5. Verify queue/report state reflects the approved decision.

SLA targets:
- Sev-1 escalation acknowledgement: ≤10 min
- Sev-2 escalation acknowledgement: ≤30 min
- Non-urgent governance clarification: same business day

---

## 4) Shift Operator Checklist

## Preflight (start of shift)
- [ ] Confirm app/API availability (`npm run dev` health check in local pilot env).
- [ ] Verify audit store writable and growing (`HUMANONLY_AUDIT_LOG_FILE`).
- [ ] Verify governed data snapshot writable (`HUMANONLY_DATA_FILE`).
- [ ] Confirm moderator/admin accounts can authenticate.
- [ ] Check moderation queue baseline and unresolved appeals count.
- [ ] Confirm no unresolved Sev-1/Sev-2 incidents from previous shift.

## During shift (every 30–60 min)
- [ ] Review moderation queue volume and oldest-open report age.
- [ ] Review appeals backlog and median time-to-decision.
- [ ] Sample recent audit entries for chain continuity and action completeness.
- [ ] Check trust watchlist trends for sudden score cliffs/anomalies.
- [ ] Trigger escalation if thresholds or policy ambiguity are hit.

## Post-shift handoff
- [ ] Summarize incidents, mitigations, and pending approvals.
- [ ] Record open risks and owners for next shift.
- [ ] Confirm all emergency actions have linked governance rationale.
- [ ] Update roadmap/checklist status if milestone gates were completed.

---

## 5) Reliability Controls (Pilot Gate)

Pilot should not proceed unless all are true:
- [ ] Immutable audit writes succeed for all enforcement-sensitive endpoints.
- [ ] Data snapshot persistence survives restart and replay.
- [ ] Incident rollback path documented and dry-run tested.
- [ ] Moderation queue and appeals endpoints validated by smoke tests.
- [ ] Admin override endpoint is restricted, tested, and auditable.

Recommended hardening during Sprint 3:
1. Add audit-write failure alerting and fallback behavior.
2. Add queue latency/age metrics and threshold alerts.
3. Add periodic integrity check for audit hash chain.
4. Prepare migration checklist from file-backed storage to indexed relational DB.

---

## 6) Incident Response Workflow (Quick Path)

1. Detect: alert/operator finds anomaly.
2. Triage: classify severity + assign IC.
3. Contain: pause risky actions, protect data integrity.
4. Diagnose: identify root cause and blast radius.
5. Mitigate: rollback/fix/workaround.
6. Validate: run smoke checks + audit integrity checks.
7. Recover: resume normal ops with governance sign-off where needed.
8. Learn: document postmortem with actions and owners.

---

## 7) Postmortem Template

- Incident ID:
- Severity:
- Start/End times (IST):
- Impact summary:
- Detection method:
- Root cause:
- Mitigation actions:
- Governance decisions + rationale:
- Audit references:
- Follow-up actions (owner + due date):

---

## 8) Exit Criteria for Sprint 3 Pilot Readiness

Sprint 3 pilot readiness is complete when:
- This runbook is accepted by moderators/admins.
- At least one tabletop incident drill has been executed.
- Reliability controls checklist passes in pilot environment.
- Open Sev-1/Sev-2 risks are resolved or explicitly deferred with owner and date.
