# Photographer workspace UX — tasks

- [x] T-1: Audit actual authenticated desktop/mobile journeys and define focused changes
      Refs: R-1, R-2, R-3, R-4
      Depends: none
      Verify: inspect numbered screenshots 01–10 from this audit run.
      Evidence: baseline audit in design.md; local synthetic captures /tmp/lunia-admin-audit.
- [x] T-2: Implement inbox prioritization, customer task sections and queue review filters
      Refs: R-1, R-2, R-3, R-4
      Depends: T-1
      Verify: targeted integration/browser regressions and actual after screenshots.
      Evidence: 22 follow-up integrations; all 6 targeted workspace browser cases passed. Production-build screenshots linked from design.md; cancellation focus and 390px overflow checked manually.
- [ ] T-3: Verify complete aggregate suite, exact-head CI and preview availability
      Refs: R-1, R-2, R-3, R-4
      Depends: T-2
      Verify: npm run verify, fresh CI at exact SHA, preview metadata and honest auth limits.
      Evidence: production build, static checks, 36 unit, 55 integration, 35 Python, 4 hook, 12 release and 1 built-dependency checks passed. Initial aggregate browser run exposed shared fixture rate limits; isolated helper correction passed the focused browser case. Fresh aggregate/exact-head CI and hosted preview remain pending.
