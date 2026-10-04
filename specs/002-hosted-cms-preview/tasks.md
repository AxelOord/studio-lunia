# Tasks

Application implementation is in progress. Ready means structurally reviewable; none of
these end-to-end tasks is complete until its hosted acceptance passes. Resource/grant
setup and hosted acceptance are still pending; free preview resources and scoped connections
are approved for the unpaid synthetic prototype. See docs/hosted-cms-runbook.md.

- [ ] T-1: Resolve provider, compatibility and authorization decisions
      Refs: R-1, R-2, R-3, R-5, R-6, R-7
      Depends: none
      Verify: Record chosen branch/providers/regions, current quotas and estimate, owner, explicit spending/resource/credential approval; inspect pinned adapters and current advisories.
      Evidence: Neon Free/private Blob Frankfurt/Resend Free and preview-branch connections approved; mailbox confirmed privately. No paid upgrade required for current unpaid synthetic prototype. Secure provider setup and quota checks pending.
- [ ] T-2: Add isolated durable preview configuration and migration runbook
      Refs: R-1, R-4, R-5
      Depends: T-1
      Verify: Test missing-config/other-branch rejection; provision only approved resources; clean/existing-schema and failed migrations; confirm no build-time mutation or CI secrets.
      Evidence: Fail-closed mode tests and local migration pass; operator advisory lock and target-confirmation CLI added. Hosted migration/failure rehearsal pending.
- [ ] T-3: Implement and verify bounded private media persistence
      Refs: R-1, R-2, R-6
      Depends: T-2
      Verify: Direct-upload compatibility spike; hosted original/derivative access matrix; oversize/invalid/interrupted upload, cache revocation, orphan cleanup and persistence after redeploy.
      Evidence: Local SDK-boundary tests cover signed receipts, tempfile success/failure cleanup and finalized variant deletion without touching unrelated uploads. Raw provider orphans remain inventory candidates. Provider ACL/CORS, real uploads, orphan cleanup and redeploy persistence remain unverified.
- [ ] T-4: Enable editor bootstrap, recovery and authenticated draft preview
      Refs: R-3, R-4, R-6
      Depends: T-2, T-3
      Verify: Operator bootstrap repeat denial; no public signup; login/logout/expiry/CSRF; real approved-mailbox reset, reused/expired token denial, two-context draft access and perimeter checks.
      Evidence: Local reset expiry/reuse/throttle tests and browser draft tests including private hero/gallery images, cookie removal and cache denial. Real mailbox delivery and hosted bootstrap/auth tests remain pending.
- [ ] T-5: Prove recovery and hand over the hosted slice
      Refs: R-1, R-2, R-3, R-4, R-5, R-6, R-7
      Depends: T-3, T-4
      Verify: Restore DB/media to disposable target; counts/hashes and recovery timings; clean install/patch/audit, npm run check/build/test:integration/test:e2e; exact-head hosted login-upload-draft-publish-redeploy flow with desktop/mobile screenshots, redacted logs and unchanged old-project evidence.
      Evidence: Local PostgreSQL dump restored to a disposable DB with matching baseline counts. Hosted coordinated database/media recovery and final hosted visual QA remain pending.
