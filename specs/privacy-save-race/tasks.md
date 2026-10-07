# Privacy save race — tasks

- [x] T-1: Reproduce and coordinate privacy saves across tabs
      Refs: R-1, R-2
      Depends: none
      Verify: pre-fix browser reproduction, real overlap/cookie/revocation/fresh-grant regression.
      Evidence: verification.md records the pre-fix browser failure and 18 passing focused browser journeys, including real cookie/revocation and fresh-reconsent assertions.
- [ ] T-2: Verify preservation and publish exact-head evidence
      Refs: R-1, R-2, P-1
      Depends: T-1
      Verify: focused browser cases, full npm run verify, exact-head CI and one automatic preview outcome.
      Evidence: verification.md records full local verification (50 unit, 103 integration, 52 browser plus tooling/build); exact-head CI and publication are pending at this source checkpoint and will be recorded in PR #45.
