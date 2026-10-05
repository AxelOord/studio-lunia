# Customer records, activity and email history — tasks

- [x] T-1: Implement linked records, migrations and transactional booking/revenue operations
      Refs: R-1, R-2, R-3, R-7
      Depends: none
      Verify: migration preservation, access, repeated/concurrent commands and corrections integration tests.
      Evidence: 28 passing integration tests include legacy migration preservation, private access, concurrent booking commands and append-only money corrections; see evidence.md.
- [x] T-2: Implement customer activity, filters and staff workflows
      Refs: R-1, R-2, R-3, R-4, R-7
      Depends: T-1
      Verify: multiple related records, explicit linking, timeline consistency, desktop/mobile keyboard journeys.
      Evidence: Three new browser scenarios pass, including desktop/mobile staff actions and timeline; inspected customer-booking and customer-timeline screenshots; see evidence.md.
- [x] T-3: Implement template preview, immutable messages and shared sandbox sender
      Refs: R-4, R-5, R-6, R-7
      Depends: T-1, T-2
      Verify: renderer variables/escaping, snapshot preservation, no send on preview, bounded idempotent retries and recipient limits.
      Evidence: Renderer unit checks and sender/snapshot integration cases pass; browser preview/draft checks prove editing does not send; see evidence.md.
- [x] T-4: Implement verified delivery webhook ingestion and order-safe history
      Refs: R-4, R-6, R-7
      Depends: T-3
      Verify: official signature fixture, invalid/expired/tampered input, concurrent duplicates, early and reordered callbacks.
      Evidence: Official Svix fixture plus minimal parsing, concurrent duplicate, early callback and reordered delivery integration tests pass. Live ingress remains disabled and unverified; see evidence.md.
- [ ] T-5: Complete aggregate verification, draft PR and automatic preview acceptance
      Refs: R-1, R-2, R-3, R-4, R-5, R-6, R-7, R-8
      Depends: T-1, T-2, T-3, T-4
      Verify: check, format, integration, build, full browser suite, screenshots, exact-head CI and full CMS preview; disclose provider gates.
      Evidence: Local check/build/format, 28 integration tests and all 18 browser tests pass; draft PR/CI/hosted preview pending. See evidence.md.
