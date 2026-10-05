# Tasks

- [x] T-1: Inspect setup and prepare minimal native preview decision
      Refs: R-1, R-2, R-3, R-4
      Depends: none
      Verify: Provider evidence, existing app gates, migrations, adapter and native docs.
      Evidence: docs/full-cms-preview-decision.md supersedes controller-first proposal; no activation.
- [ ] T-2: Confirm access tradeoffs and safe native configuration
      Refs: R-2, R-4
      Depends: T-1
      Verify: Preview-only connection, synthetic source/database, role scope, trusted-preview capabilities and private bootstrap.
      Evidence: Awaiting native setup handoff; no secrets requested in chat.
- [ ] T-3: Implement minimal automatic CMS preview build and configuration
      Refs: R-1, R-2, R-3
      Depends: T-2
      Verify: Migration locking, bootstrap idempotence, origin, namespace checks, fork restrictions and build failures.
      Evidence: Not implemented; native resource settings remain unchanged by this task.
- [ ] T-4: Prove complete hosted preview behavior
      Refs: R-1, R-2, R-3, R-4
      Depends: T-3
      Verify: Exact-head CI, login/upload/draft/publish/reset/rebuild, two branches and concurrent commits.
      Evidence: Interim showcase does not satisfy full-CMS acceptance.
