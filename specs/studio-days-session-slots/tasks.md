# Studio-day pages and session slots — tasks

- [x] T-1: Add studio-day schema, immutable schedules and safe publication
      Refs: R-1, R-4, R-6
      Depends: none
      Verify: field/draft validation, publish acknowledgement, DST, migration preservation and private slots.
      Evidence: studio integration, migration up/down/up and time/currency tests passed in the aggregate. Native draft/edit/publish browser journey passed; legacy values remain preserved. See verification.md.
- [x] T-2: Implement capacity-safe reservation and staff changes
      Refs: R-3, R-4, R-6
      Depends: T-1
      Verify: database guards, public/staff concurrency, pending allocation, retries/conflicts, abandonment and failed move rollback.
      Evidence: 14 studio database cases passed, including eight public/staff contenders, raw SQL guards, cross-revision/cross-day capacity, pending allocation, duplicate keys and rollback. Browser stale-slot recovery and native cancellation also passed.
- [x] T-3: Connect existing customer records and private message simulations
      Refs: R-4, R-5
      Depends: T-2
      Verify: enquiry-free handoff, snapshots/history, failure/retry, obsolete drafts/jobs and confirmed-only preparation rules.
      Evidence: durable message failure/retry, confirmation-only rules, obsolete drafts/jobs and enquiry-free customer history passed. Full existing customer/follow-up suites remain green; no visitor transport is called.
- [x] T-4: Build public and photographer studio-day flows
      Refs: R-1, R-2, R-4, R-5, R-6
      Depends: T-2, T-3
      Verify: accessible responsive editor/public/staff journeys, every availability state, consent/minimization and private draft preview.
      Evidence: five studio Chromium journeys passed, including mobile staff entry/approval/rescheduling/cancellation, native publishing, no-consent/withdrawal, sold-out recovery and refresh failure. Eight screenshots were inspected and committed under evidence/.
- [ ] T-5: Verify and publish the reviewable batch
      Refs: R-1, R-2, R-3, R-4, R-5, R-6, R-7
      Depends: T-4
      Verify: aggregate tests, actual screenshot inspection, independent review, draft PR issue links, exact-head CI and disclosed quota-blocked hosted checks.
      Evidence: npm run verify passed at application/test head 1e0ab587: 38 unit, 76 integration, 35 Python, 4 hook, 12 release, 1 built-dependency and 37 browser tests, static/generated checks and production build. Final evidence changes only docs/images. Independent review and hosted acceptance remain open; exact-head CI and the single automatic deployment will be recorded in the draft PR. Neon is verified 10/10; no provisioning retry or provider mutation is authorized.
