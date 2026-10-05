# Studio-day pages and session slots — tasks

- [ ] T-1: Add studio-day schema, immutable schedules and safe publication
      Refs: R-1, R-4, R-6
      Depends: none
      Verify: field/draft validation, publish acknowledgement, DST, migration preservation and private slots.
      Evidence: pending
- [ ] T-2: Implement capacity-safe reservation and staff changes
      Refs: R-3, R-4, R-6
      Depends: T-1
      Verify: database guards, public/staff concurrency, pending allocation, retries/conflicts, abandonment and failed move rollback.
      Evidence: pending
- [ ] T-3: Connect existing customer records and private message simulations
      Refs: R-4, R-5
      Depends: T-2
      Verify: enquiry-free handoff, snapshots/history, failure/retry, obsolete drafts/jobs and confirmed-only preparation rules.
      Evidence: pending
- [ ] T-4: Build public and photographer studio-day flows
      Refs: R-1, R-2, R-4, R-5, R-6
      Depends: T-2, T-3
      Verify: accessible responsive editor/public/staff journeys, every availability state, consent/minimization and private draft preview.
      Evidence: pending
- [ ] T-5: Verify and publish the reviewable batch
      Refs: R-1, R-2, R-3, R-4, R-5, R-6, R-7
      Depends: T-4
      Verify: aggregate tests, actual screenshot inspection, independent review, draft PR issue links, exact-head CI and disclosed quota-blocked hosted checks.
      Evidence: pending
