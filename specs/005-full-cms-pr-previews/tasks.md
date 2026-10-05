# Tasks

- [x] T-1: Inspect actual setup and primary provider docs; prepare decision
      Refs: R-1, R-2, R-3, R-4
      Depends: none
      Verify: Review current config/roles/storage adapter and native integration/cost docs.
      Evidence: docs/full-cms-preview-decision.md records actual branch scope, runtime DDL restriction, upload token requirement, provider limitations, recommendation and approval bundle. No activation.
- [ ] T-2: Approve handoff and prove provider capability in disposable resources
      Refs: R-2, R-4
      Depends: T-1
      Verify: Actual account limits, key scope, two isolated DB/store resources, runtime grants, no migration credential in runtime.
      Evidence: Awaiting explicit resource/credential/lifecycle approval; no secrets requested in chat.
- [ ] T-3: Implement ordered provisioning, migration, bootstrap and cleanup
      Refs: R-1, R-2, R-3
      Depends: T-2
      Verify: Idempotence, concurrency, failure preservation, fork denial, current-SHA enforcement and cleanup dry run.
      Evidence: Not activated; architecture depends on provider spike and approved access.
- [ ] T-4: Prove complete hosted CMS preview lifecycle
      Refs: R-1, R-2, R-3, R-4
      Depends: T-3
      Verify: Exact-head CI/deployment, login/upload/draft/publish/reset/redeploy and two-PR isolation.
      Evidence: Interim showcase is not full-CMS acceptance.
