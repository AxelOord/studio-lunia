# Service landing to enquiry — tasks

- [ ] T-1: Extend existing content fields and canonical service resolution
      Refs: R-1, R-2, R-4
      Depends: none
      Verify: Pinned field/live-preview APIs, native selection, optional content validation, invalid/unpublished targets and additive migration preservation.
      Evidence: pending
- [ ] T-2: Build the selected-service landing and short enquiry journey
      Refs: R-1, R-2, R-3, R-4
      Depends: T-1
      Verify: Responsive primary action, retained service, visible offer and next steps, existing validation/retry/receipt semantics, no fabricated promises.
      Evidence: pending
- [ ] T-3: Add synthetic demonstration and full flow regressions
      Refs: R-3, R-5, R-6
      Depends: T-2
      Verify: Idempotent preview/local initialization; tagged/consented, withdrawal and no-consent submission; safe errors/retry/dedupe; private staff handoff with original snapshots.
      Evidence: pending
- [ ] T-4: Verify and deliver the focused batch
      Refs: R-1, R-2, R-3, R-4, R-5, R-6, R-7
      Depends: T-3
      Verify: Aggregate tests, screenshot inspection and accessible artifacts, independent review, exact-head CI, available preview capacity and automatic full-CMS deployment.
      Evidence: pending
