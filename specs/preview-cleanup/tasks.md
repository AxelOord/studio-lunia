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
- [x] T-4: Publish a separate draft and verify exact-head CI
      Refs: R-5
      Depends: T-3
      Verify: linked draft for issue #46, exact-head CI and one normal preview outcome.
      Evidence: recovered draft PR47 and issue46; d8ea495 Foundation 37811527106 and Hook 37811451542 passed. Follow-up head results are recorded in the PR body without activation.

- [x] T-5: Complete gated production execution and native observation
      Refs: R-1, R-2, R-3, R-4
      Depends: T-1, T-2
      Verify: fake HTTP DELETE, native branch identity, missing/retained resources and approval denials.
      Evidence: verification.md records 118 fake-provider cleanup tests, including real adapter composition and reconciliation; no provider writes.
- [x] T-6: Reconcile missed events without expanding deletion scope
      Refs: R-3, R-5
      Depends: T-5
      Verify: missed close events, delayed branch removal/build completion, cutoff and partial batches.
      Evidence: verification.md records 118 fake-provider cleanup tests, including real adapter composition and reconciliation; no provider writes.
- [x] T-7: Verify native absence by immutable ID and document alias evidence limits
      Refs: R-1, R-4, R-5
      Depends: T-5, T-6
      Verify: fake HTTP rename, replacement, missing identity, immutable-ID errors and full checks; supported alias schema review.
      Evidence: verification.md records 131 cleanup tests and the full passing aggregate; docs/preview-cleanup.md records pinned SDK/API evidence and the unresolved alias policy decision.
- [x] T-8: Register and consume trusted disposable-preview ownership
      Refs: R-1, R-2, R-3, R-4, R-5, R-6
      Depends: T-7
      Verify: exact adoption and trusted-completion contracts, alias/domain/race protections, atomic registry updates, full checks and existing draft publication.
      Evidence: verification.md records the full aggregate, 170 passing cleanup/registration tests and final static/unit/tooling checks; ownership records and all activation gates remain empty/disabled.
