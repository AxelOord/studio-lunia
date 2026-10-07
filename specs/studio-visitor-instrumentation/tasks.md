# Studio visitor instrumentation — tasks

- [x] T-1: Implement and verify minimized studio stages and consent/retry boundaries
      Refs: R-1, R-2
      Depends: none
      Verify: unit, PostgreSQL integration and real HTTP/browser tests with inert provider transport.
      Evidence: verification.md; 11 focused unit, 5 real PostgreSQL and 4 focused Chromium cases pass.
- [x] T-2: Update explicit coverage/privacy labels and audit approved ticket gaps
      Refs: R-3
      Depends: T-1
      Verify: reporting/browser assertions and repository issue comparison.
      Evidence: verification.md; report/privacy labels checked; existing tickets preserved and missing public accessibility follow-up recorded as #43.
- [ ] T-3: Verify aggregate, inspect desktop/mobile screenshots and publish draft handoff
      Refs: R-4
      Depends: T-1, T-2
      Verify: npm run verify; inspected screenshots; exact-head remote CI and single preview result.
      Evidence: verification.md and draft PR checkpoint; local aggregate and five inspected screenshots pass; exact-head checks are recorded at publication, hosted acceptance remains blocked.
