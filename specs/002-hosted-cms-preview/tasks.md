# Tasks

All implementation is pending. This docs-only PR defines the work; ready means structurally
reviewable, not provisioned or approved. Execute in small follow-up PRs with real evidence.

- [ ] T-1: Resolve provider, compatibility and authorization decisions
      Refs: R-1, R-2, R-3, R-5, R-6, R-7
      Depends: none
      Verify: Record chosen branch/providers/regions, current quotas and estimate, owner, explicit spending/resource/credential approval; inspect pinned adapters and current advisories.
      Evidence: pending
- [ ] T-2: Add isolated durable preview configuration and migration runbook
      Refs: R-1, R-4, R-5
      Depends: T-1
      Verify: Test missing-config/other-branch rejection; provision only approved resources; clean/existing-schema and failed migrations; confirm no build-time mutation or CI secrets.
      Evidence: pending
- [ ] T-3: Implement and verify bounded private media persistence
      Refs: R-1, R-2, R-6
      Depends: T-2
      Verify: Direct-upload compatibility spike; hosted original/derivative access matrix; oversize/invalid/interrupted upload, cache revocation, orphan cleanup and persistence after redeploy.
      Evidence: pending
- [ ] T-4: Enable editor bootstrap, recovery and authenticated draft preview
      Refs: R-3, R-4, R-6
      Depends: T-2, T-3
      Verify: Operator bootstrap repeat denial; no public signup; login/logout/expiry/CSRF; real approved-mailbox reset, reused/expired token denial, two-context draft access and perimeter checks.
      Evidence: pending
- [ ] T-5: Prove recovery and hand over the hosted slice
      Refs: R-1, R-2, R-3, R-4, R-5, R-6, R-7
      Depends: T-3, T-4
      Verify: Restore DB/media to disposable target; counts/hashes and recovery timings; clean install/patch/audit, npm run check/build/test:integration/test:e2e; exact-head hosted login-upload-draft-publish-redeploy flow with desktop/mobile screenshots, redacted logs and unchanged old-project evidence.
      Evidence: pending
