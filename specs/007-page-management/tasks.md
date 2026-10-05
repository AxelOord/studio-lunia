# Tasks — approved implementation

- [x] T-1: Inspect current code, pinned capabilities and available visual evidence
      Refs: R-1, R-2, R-3, R-4, R-5, R-6
      Depends: none
      Verify: Actual PR/base state, installed canary types, tagged official docs and representative local screenshot.
      Evidence: Initial review inspected PR5 0970cbd and develop 3f1d2ed; the implementation update in review.md records the merged base, pinned native APIs and local screenshot provenance.
- [x] T-2: Review and accept the bounded spec
      Refs: R-1, R-2, R-3, R-4, R-5, R-6
      Depends: T-1
      Verify: Read approved issues #6–#8 and all comments; verify current merged develop base.
      Evidence: Axel explicitly approved implementation and full CMS previews on 2026-10-05. All three issue comment endpoints were empty. PR5 merged into develop at 0a7b495; the local spec commit was rebased without overwriting other work.
- [x] T-3: Configure native page/block/media presentation after approval
      Refs: R-1, R-2, R-3, R-5, R-6
      Depends: T-2
      Verify: Type/import-map checks, zero schema change, existing document round-trip and keyboard/visual editor QA.
      Evidence: review.md records build/check/format, unchanged migration directory after the SQL diff probe, 14 integration tests and browser verification in tests/e2e/page-management.spec.ts.
- [x] T-4: Integrate native live preview and verify unsaved behavior after approval
      Refs: R-4, R-5, R-6
      Depends: T-3
      Verify: Exact-version bridge; unsaved text/image/reorder, mobile viewport, changed slug, incomplete fields, authentication/origin denial and unchanged public output.
      Evidence: Five new browser tests verify all six blocks, image selection/reordering, viewports, slug/document navigation, incomplete state, no preview writes, explicit draft/publish, access/origin/session denial and latest-response ordering. Local screenshots inspected; hosted acceptance remains separate in review.md.
