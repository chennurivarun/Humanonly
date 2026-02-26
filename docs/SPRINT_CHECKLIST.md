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

## Latest run summary
- ✅ Delivered durable governed runtime storage (`HUMANONLY_DATA_FILE`) and removed dependency on volatile in-memory-only state.
- ✅ Upgraded audit logging to append-only immutable JSONL with sequence + SHA-256 hash chaining (`HUMANONLY_AUDIT_LOG_FILE`).
- ✅ Added automated tests for governed persistence + tamper detection on audit chains.

## Next actions
1. Define and implement Sprint 2 trust scoring v1 domain model + API surfaces.
2. Build appeals workflow that references immutable audit records and requires explicit human adjudication.
3. Add admin metrics endpoints/views for trust movement, queue throughput, and override rates.
