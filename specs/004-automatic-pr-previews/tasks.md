# Tasks

- [x] T-1: Enable branch previews and a complete synthetic block sample
      Refs: R-1, R-2
      Depends: none
      Verify: Config review, check/build, showcase browser checks and screenshot inspection.
      Evidence: Local check/build and credential-free Chromium showcase pass. All six blocks/four decoded images, two routes, 503 CMS access, 404 missing route and 1440/390px screenshots verified.
- [ ] T-2: Reconcile the PR and verify deployment handover
      Refs: R-1, R-3
      Depends: T-1
      Verify: Replacement draft to develop, exact-head CI, Vercel exact commit/READY and browser QA.
      Evidence: External deployment verification pending; no secrets copied or widened.
