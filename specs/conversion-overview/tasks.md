# Conversion overview — tasks

- [x] T-1: Implement authorized snapshot reporting and metric definitions
      Refs: R-1, R-2, R-3, R-4
      Depends: none
      Verify: cohort, ledger, campaign, status, source pagination, published occupancy and access integration tests.
      Evidence: verification.md; six reporting unit and seven owned PostgreSQL integration cases pass.
- [x] T-2: Add first-response attestation and private report UI
      Refs: R-3, R-4
      Depends: T-1
      Verify: command validation/idempotency/correction/clear and responsive keyboard/source browser flows.
      Evidence: verification.md; database commands and two actual Chromium journeys pass; desktop/mobile screenshots.
- [x] T-3: Add disabled EU aggregate reader and coverage states
      Refs: R-5
      Depends: T-1
      Verify: no request by default, fixed query/host, valid counts, failures and minimization.
      Evidence: verification.md; fixed-query, disabled/default, malformed/failed/oversized response and minimization unit coverage.
- [ ] T-4: Verify and publish the focused implementation checkpoint
      Refs: R-1, R-2, R-3, R-4, R-5, R-6
      Depends: T-2, T-3
      Verify: aggregate, exact-head CI, inspected screenshots, draft PR, automatic preview and provider gates.
      Evidence: verification.md and the draft PR checkpoint; hosted acceptance and provider activation remain blocked/open.
