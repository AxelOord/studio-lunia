# Preview cleanup — tasks

- [x] T-1: Implement exact read-only planning and disabled trusted entrypoints
      Refs: R-1, R-2
      Depends: none
      Verify: ownership, fork, protected/shared branch, transport and workflow tests.
      Evidence: verification.md records 82 passing cleanup tests and the GET-only/hard-disabled live boundary.
- [x] T-2: Verify execution simulation, concurrency and recovery
      Refs: R-3, R-4
      Depends: T-1
      Verify: fake-provider races, idempotency, pagination and partial failures.
      Evidence: verification.md records 82 passing cleanup tests and the GET-only/hard-disabled live boundary.
- [x] T-3: Document operational handover and verify preservation
      Refs: R-5
      Depends: T-1, T-2
      Verify: full npm run verify and review of management/default-branch/activation limits.
      Evidence: verification.md records the successful full aggregate, including all 21 existing browser journeys; docs/preview-cleanup.md records the operational boundaries.
- [ ] T-4: Publish a separate draft and verify exact-head CI
      Refs: R-5
      Depends: T-3
      Verify: linked draft for issue #46, exact-head CI and one normal preview outcome.
      Evidence: pending at source checkpoint; terminal results will be recorded in the draft PR conversation without activating cleanup.
