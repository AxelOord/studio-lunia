# Release automation tasks

- [x] T-1: Verify live history, closure behavior and provider permission boundaries
      Refs: R-1, R-5
      Depends: none
      Verify: Read live PR21/issue20/default branch; compare official release/token docs.
      Evidence: PR21 merged at4fed010 into develop, issue20 open, default master. design.md records exact access and sources.
- [x] T-2: Implement and verify deterministic candidate and lifecycle jobs
      Refs: R-1, R-2, R-3, R-4, R-5
      Depends: T-1
      Verify: Real temporary Git candidate tests, simulated API failure/retry/membership and local check; full application CI on the draft PR.
      Evidence: Clean npm ci and local check passed (19 existing unit, 35 Python, initially7 release tests); expanded9 release tests and lint also pass. review.md records the verification boundary; exact-head hosted CI is reported on the PR. No real lifecycle writes were executed.
- [ ] T-3: Activate approved provider configuration after review
      Refs: R-5
      Depends: T-2
      Verify: Confirm selected status backend, environment protections, job grants and switches through provider readback.
      Evidence: Blocked pending explicit permission/configuration review; this draft does not merge or enable writers.
