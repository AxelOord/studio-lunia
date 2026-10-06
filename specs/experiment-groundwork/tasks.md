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
- [x] T-4: Verify and publish draft checkpoint
      Refs: R-1, R-2, R-3, R-4, R-5
      Depends: T-3
      Verify: npm run verify, exact-head CI, one preview outcome and PR dependencies.
      Evidence: PR #45 checkpoint https://github.com/AxelOord/studio-lunia/pull/45#issuecomment-6019848323 records local verification, exact-head CI success and the blocked automatic preview for ff443ce.

- [ ] T-5: Integrate PR #44 and verify the combined consent contracts
      Refs: R-2, R-3, R-5, R-6
      Depends: T-4
      Verify: combined consent/withdrawal/stale-read browser journey, full npm run verify and exact-head CI.
      Evidence: four focused browser journeys and full combined verification passed (50 unit, 103 integration, 50 Chromium plus tooling/build); see verification.md. Exact-head CI and publication are pending at this source checkpoint and will be recorded in the PR conversation.
