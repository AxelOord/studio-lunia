# Tasks

- [x] T-1: Implement composable CMS blocks and additive migration
      Refs: R-1, R-3
      Depends: none
      Verify: Generate types/migration; migrate existing local DB; integration tests round-trip content, order, defaults and reject invalid publication.
      Evidence: Generated additive migration applied to the existing local PostgreSQL database; page count and row digest unchanged. All 11 integration tests pass, including block/draft order, publication isolation and invalid CTA/card rejection.
- [x] T-2: Render provisional responsive blocks and verify the editor journey
      Refs: R-1, R-2, R-3
      Depends: T-1
      Verify: CMS edit/save/preview in Playwright; desktop/mobile screenshots and actual image pixels; access, keyboard/link and overflow checks.
      Evidence: Five Chromium scenarios pass. Actual admin CTA insertion, image-side/text edit, Save Draft and reload verified. Authenticated private images load; public views hide them. Desktop 1440px and mobile 390px screenshots inspected; no overflow, correct stacking/headings, escaped text and keyboard CTA navigation. Reference pixels remain unavailable.
- [ ] T-3: Complete isolated review and exact-head CI
      Refs: R-3, R-4
      Depends: T-1, T-2
      Verify: Full local checks, build, existing tests, branch deployment isolation, clean diff, replacement draft PR to develop and exact-head CI; review without merging.
      Evidence: Local lint/types, 11 JS tests, 35 Python tests, 11 integration tests, build, upload-trace probe, five browser scenarios and showcase pass. Automatic synthetic previews are authorized by spec 004. Exact-head CI is reported in the PR; review remains open. Hosted CMS acceptance is separate.
