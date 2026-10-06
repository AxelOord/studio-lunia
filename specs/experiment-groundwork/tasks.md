# Experiment groundwork — tasks

- [x] T-1: Implement private experiment planning and immutable lifecycle
      Refs: R-1
      Depends: none
      Verify: authoring/access/migration integration cases.
      Evidence: verification.md; targeted database and browser coverage passes, screenshots inspected.
- [x] T-2: Implement consent-aware assignment and deduplicated outcomes
      Refs: R-2, R-3
      Depends: T-1
      Verify: PostgreSQL concurrency and browser grant/withdraw/retry flows.
      Evidence: verification.md; targeted database and browser coverage passes, screenshots inspected.
- [x] T-3: Build results, simulation and retain-as-draft controls
      Refs: R-4
      Depends: T-2
      Verify: exact counts, private access, responsive browser screenshots and draft preservation.
      Evidence: verification.md; targeted database and browser coverage passes, screenshots inspected.
- [ ] T-4: Verify and publish draft checkpoint
      Refs: R-1, R-2, R-3, R-4, R-5
      Depends: T-3
      Verify: npm run verify, exact-head CI, one preview outcome and PR dependencies.
      Evidence: full local verification and five inspected screenshots are recorded in verification.md. Publication and exact-head remote results belong in the draft PR body; pending at this source checkpoint.
