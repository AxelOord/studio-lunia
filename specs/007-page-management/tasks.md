# Tasks — review first

- [x] T-1: Inspect current code, pinned capabilities and available visual evidence
      Refs: R-1, R-2, R-3, R-4, R-5, R-6
      Depends: none
      Verify: Actual PR/base state, installed canary types, tagged official docs and representative local screenshot.
      Evidence: review.md records PR5 0970cbd, develop 3f1d2ed, native APIs, missing frontend bridge and local screenshot provenance. Hosted visual audit unavailable because the session expired; no user login requested.
- [ ] T-2: Review and accept the bounded spec
      Refs: R-1, R-2, R-3, R-4, R-5, R-6
      Depends: T-1
      Verify: Axel accepts tabs, explicit Save Draft and one-time save before live preview; confirm deployment-free documentation handoff and eventual implementation base.
      Evidence: Proposed for review only; no implementation approval assumed.
- [ ] T-3: Configure native page/block/media presentation after approval
      Refs: R-1, R-2, R-3, R-5, R-6
      Depends: T-2
      Verify: Type/import-map checks, zero schema change, existing document round-trip and keyboard/visual editor QA.
      Evidence: Not started.
- [ ] T-4: Integrate native live preview and verify unsaved behavior after approval
      Refs: R-4, R-5, R-6
      Depends: T-3
      Verify: Exact-version bridge; unsaved text/image/reorder, mobile viewport, changed slug, incomplete fields, authentication/origin denial and unchanged public output.
      Evidence: Not started; no package installed or route changed.
