# Tasks

- [x] T-1: Inspect setup and prepare minimal native preview decision
      Refs: R-1, R-2, R-3, R-4
      Depends: none
      Verify: Provider evidence, existing app gates, migrations, adapter and native docs.
      Evidence: docs/full-cms-preview-decision.md supersedes controller-first proposal; no activation.
- [x] T-2: Confirm access tradeoffs and safe native configuration
      Refs: R-2, R-4
      Depends: T-1
      Verify: Preview-only connection, synthetic source/database, role scope, trusted-preview capabilities and private bootstrap.
      Evidence: Axel approved full-CMS preview access on 2026-10-05; native worker confirmed Preview-only integration and empty neondb/neondb_owner source. No values disclosed; per-deployment identity remains T-4.
- [x] T-3: Implement minimal automatic CMS preview build and configuration
      Refs: R-1, R-2, R-3
      Depends: T-2
      Verify: Migration locking, bootstrap idempotence, origin, namespace checks, fork restrictions and build failures.
      Evidence: scripts/preview-build.ts, scripts/prepare-preview.ts, origin/repository gates and Blob namespace checks implemented. Local check (15 JS and 35 Python tests), 13 integration tests, build, upload tracing and 5 CMS browser tests pass; desktop/mobile/admin screenshots inspected. Fresh schema, bootstrap idempotence and namespace denial are exercised; exact-head CI tracked in the draft PR.
- [ ] T-4: Prove complete hosted preview behavior
      Refs: R-1, R-2, R-3, R-4
      Depends: T-3
      Verify: Exact-head CI, login/upload/draft/publish/reset/rebuild, two branches and concurrent commits.
      Evidence: Interim showcase does not satisfy full-CMS acceptance.
