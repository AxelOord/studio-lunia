# Reliable test foundation — tasks

- [ ] T-1: Reproduce and fix the borrowed media fixture in PR34
      Refs: R-1, P-1, P-2
      Depends: none
      Verify: Standalone failure before repair, repeated passes on clean databases, aggregate checks, exact-head CI and automatic preview.
      Evidence: 2026-10-05: CI 37365324916 at a458215 reports media ID 3 absent (23503). A standalone clean-database run reproduced the missing fixture (0/1), then passed after the test created its own image (1/1). Three independently created/migrated/seeded databases each passed the concurrent CMS/Blob suites (11/11), then were removed. All 29 integration tests and aggregate check/build/format checks pass; all 19 browser scenarios pass. Exact-head CI and hosted evidence pending.
- [ ] T-2: Inventory coverage and implement isolated integration fixtures
      Refs: R-2, R-3, P-1
      Depends: T-1
      Verify: Document each existing suite/check and preserve its negative cases; selected tests alone and concurrent suites pass with cleanup.
      Evidence: pending
- [ ] T-3: Align pinned runners, local verification and CI stages
      Refs: R-3, R-4, R-6, P-1
      Depends: T-2
      Verify: One local full command matches CI, unique Python checks retained, failure diagnostics exercised.
      Evidence: pending
- [ ] T-4: Verify full browser journeys and exact-head protected preview
      Refs: R-2, R-4, R-5, P-1, P-2
      Depends: T-3
      Verify: Repeated clean-database runs, Playwright flow checks/screenshots, exact-head CI and automatic CMS preview.
      Evidence: pending
