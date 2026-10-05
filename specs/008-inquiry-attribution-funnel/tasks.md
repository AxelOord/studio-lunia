# Inquiry, attribution and consent — tasks

- [x] T-1: Implement private enquiry operations and accessible form
      Refs: R-1, R-2
      Depends: none
      Verify: unit, Payload integration and desktop/mobile browser enquiry journeys.
      Evidence: review.md — 27 unit, 19 integration and 15 full browser tests pass; build and screenshots verified.
- [x] T-2: Implement signed consent and channel-neutral attribution
      Refs: R-3, R-4
      Depends: T-1
      Verify: attribution matrix, cookie tamper/expiry, decline/withdrawal and navigation tests.
      Evidence: tests/inquiry.test.ts, tests/integration/inquiry.test.ts and tests/e2e/inquiry.spec.ts pass, including consent and storage boundaries.
- [x] T-3: Implement minimized EU funnel and provider boundary
      Refs: R-4, R-5
      Depends: T-1, T-2
      Verify: exact outgoing payload, no-consent, unconfigured, duplicate and provider-failure tests.
      Evidence: exact EU payload/deduplication integration and browser request tests pass; no hosted provider claim; activation remains gated.
- [ ] T-4: Complete aggregate verification and draft PR preview evidence
      Refs: R-1, R-2, R-3, R-4, R-5, R-6
      Depends: T-1, T-2, T-3
      Verify: npm run check, format:check, integration, build, e2e, exact-head CI and full CMS preview.
      Evidence: pending
