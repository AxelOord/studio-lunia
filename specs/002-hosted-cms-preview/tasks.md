# Tasks

Application implementation is in progress. Ready means structurally reviewable; none of
these end-to-end tasks is complete until its hosted acceptance passes. Resource/grant
setup has progressed through hosted bootstrap and protected deployment; final hosted acceptance
is still pending. See docs/hosted-cms-runbook.md for verified milestones and open limits.

- [ ] T-1: Resolve provider, compatibility and authorization decisions
      Refs: R-1, R-2, R-3, R-5, R-6, R-7
      Depends: none
      Verify: Record chosen branch/providers/regions, current quotas and estimate, owner, explicit spending/resource/credential approval; inspect pinned adapters and current advisories.
      Evidence: Neon Free/private Blob Frankfurt/Resend Free and exact preview-branch credentials provisioned; mailbox confirmed privately. No paid upgrade for this unpaid synthetic prototype. Quota/advisory handover remains open.
- [ ] T-2: Add isolated durable preview configuration and migration runbook
      Refs: R-1, R-4, R-5
      Depends: T-1
      Verify: Test missing-config/other-branch rejection; provision only approved resources; clean/existing-schema and failed migrations; confirm no build-time mutation or CI secrets.
      Evidence: Fail-closed mode tests pass. User confirmed hosted backup/restore, migrations, restricted runtime authentication/rollback CRUD and bootstrap. Protected exact-head preview activated. Hosted failure/recovery acceptance remains incomplete.
- [ ] T-3: Implement and verify bounded private media persistence
      Refs: R-1, R-2, R-6
      Depends: T-2
      Verify: Direct-upload compatibility spike; hosted original/derivative access matrix; oversize/invalid/interrupted upload, cache revocation, orphan cleanup and persistence after redeploy.
      Evidence: Hosted PNG upload/save succeeded after the traced-dependency fix; subsequent private-image GET returned 404. Normal hidden-field behavior reproduced the path mismatch locally and full-byte checks exposed an empty temporary-file original. Adapter fixes pass the real Payload file endpoint with private/public/revocation checks locally. Hosted rendering retest, provider ACL/CORS, orphan handling and media persistence remain open.
- [ ] T-4: Enable editor bootstrap, recovery and authenticated draft preview
      Refs: R-3, R-4, R-6
      Depends: T-2, T-3
      Verify: Operator bootstrap repeat denial; no public signup; login/logout/expiry/CSRF; real approved-mailbox reset, reused/expired token denial, two-context draft access and perimeter checks.
      Evidence: Hosted editor bootstrap/login and text draft save/reload/edit/reload confirmed. Local reset expiry/reuse/throttle and private-draft tests pass. Actual mailbox delivery and hosted private-media/session acceptance remain open.
- [ ] T-5: Prove recovery and hand over the hosted slice
      Refs: R-1, R-2, R-3, R-4, R-5, R-6, R-7
      Depends: T-3, T-4
      Verify: Restore DB/media to disposable target; counts/hashes and recovery timings; clean install/patch/audit, npm run check/build/test:integration/test:e2e; exact-head hosted login-upload-draft-publish-redeploy flow with desktop/mobile screenshots, redacted logs and unchanged old-project evidence.
      Evidence: Local PostgreSQL dump restored to a disposable DB with matching baseline counts. Hosted coordinated database/media recovery and final hosted visual QA remain pending.
