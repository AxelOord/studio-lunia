# Shared preview editor — tasks

- [x] T-1: Implement build-only default and preserve existing accounts
      Refs: R-1, R-2, R-3
      Depends: none
      Verify: Unit and real fresh-database integration tests; inspect production gate and diff.
      Evidence: 2026-10-05: 28 unit and 20 integration tests pass; two independently keyed fresh Payload/database fixtures accept one dummy default, reject anonymous creation, preserve changed passwords/content and ignore a missing or changed default. Production/configuration guards and sanitized build-error tests pass.
- [x] T-2: Document secure owner handoff and verify aggregate behavior
      Refs: R-1, R-2, R-3, R-4
      Depends: T-1
      Verify: npm run check, format:check, test:integration, build and test:e2e; inspect login screenshots.
      Evidence: 2026-10-05: npm run check passes (28 unit, 35 Python, 12 release tests), format:check and build pass; all 16 browser tests pass (39.7s). Inspected test-results/preview-login-desktop.png (1280x720) and preview-login-mobile.png (390x844): visible labeled fields, masked password input and no overflow; browser login and anonymous redirect pass. Only dummy local credentials used.
- [ ] T-3: Verify exact-head CI and protected automatic preview after owner entry
      Refs: R-3, R-4
      Depends: T-2
      Verify: Draft PR into develop, exact-head GitHub checks and authenticated hosted sign-in, with Vercel Authentication retained.
      Evidence: pending owner secure Preview-only entry of PREVIEW_EDITOR_PASSWORD, exact-head CI and protected hosted acceptance. Existing preview accounts remain unchanged.
