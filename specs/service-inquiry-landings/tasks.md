# Service landing to enquiry — tasks

- [x] T-1: Extend existing content fields and canonical service resolution
      Refs: R-1, R-2, R-4
      Depends: none
      Verify: Pinned field/live-preview APIs, native selection, optional content validation, invalid/unpublished targets and additive migration preservation.
      Evidence: pinned installed field types; generated additive migration; focused integration checks preserve published content, service IDs and private versions, reject invalid published targets and exclude draft offer changes.
- [x] T-2: Build the selected-service landing and short enquiry journey
      Refs: R-1, R-2, R-3, R-4
      Depends: T-1
      Verify: Responsive primary action, retained service, visible offer and next steps, existing validation/retry/receipt semantics, no fabricated promises.
      Evidence: three real Chromium journeys passed, including native selector/live preview/publish, tagged landing, retained service, lost-response retry and private customer handoff. Desktop/mobile screenshots inspected; final captures follow aggregate verification.
- [x] T-3: Add synthetic demonstration and full flow regressions
      Refs: R-3, R-5, R-6
      Depends: T-2
      Verify: Idempotent preview/local initialization; tagged/consented, withdrawal and no-consent submission; safe errors/retry/dedupe; private staff handoff with original snapshots.
      Evidence: synthetic bootstrap preserves editor drafts; failure injection confirms transaction rollback and clean retry. Consent/browser coverage verifies minimized tags/events, unknown or denied consent, withdrawal and identical retry identity. Existing public boundary/rate-limit coverage is unchanged.
- [ ] T-4: Verify and deliver the focused batch
      Refs: R-1, R-2, R-3, R-4, R-5, R-6, R-7
      Depends: T-3
      Verify: Aggregate tests, screenshot inspection and accessible artifacts, independent review, exact-head CI, available preview capacity and automatic full-CMS deployment.
      Evidence: full aggregate and final screenshots pending. Branch includes PR #39 fixes at ba2bbb1. New branch publishing is gated on actual Neon capacity confirmation; no inventory capability is exposed in this environment, so no new deployment was attempted.
