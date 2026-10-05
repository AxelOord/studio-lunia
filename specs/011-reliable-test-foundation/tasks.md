# Reliable test foundation — tasks

- [x] T-1: Reproduce and fix the borrowed media fixture in PR34
      Refs: R-1, P-1, P-2
      Depends: none
      Verify: Standalone failure before repair, repeated passes on clean databases, aggregate checks, exact-head CI and automatic preview.
      Evidence: 2026-10-05: CI 37365324916 at a458215 reports media ID 3 absent (23503). A standalone clean-database run reproduced the missing fixture (0/1), then passed after the test created its own image (1/1). Three independently created/migrated/seeded databases each passed the concurrent CMS/Blob suites (11/11), then were removed. All 29 integration tests and aggregate check/build/format checks pass; all 19 browser scenarios pass. Exact head 76df48a5dc641e487535549773e3824e26727af0: Foundation run 37367437391 and hook run 37367331688 succeeded (parent verified); Vercel deployment dpl_Bu6KbfeEJLveCcHHXU2QNezD3AwR is READY, protected homepage/admin login both HTTP 200. PR34 remains owner-reviewed, unmerged.
- [x] T-2: Inventory coverage and implement isolated integration fixtures
      Refs: R-2, R-3, P-1
      Depends: T-1
      Verify: Document each existing suite/check and preserve its negative cases; selected tests alone and concurrent suites pass with cleanup.
      Evidence: Initial 31 integration cases passed. A subsequent lifecycle review added an initialization-failure regression: before the fix it reproduced PostgreSQL 55006 and leaked an open pool; after owning BasePayload before init, all three fixture-isolation cases pass. Two complete runs executed concurrently, one shuffled with seed 36, both passed 31/31. CMS editorial, Blob namespace and customer money/template cases also pass when selected alone. New tests verify two real databases stay isolated, failed setup removes its database/media directory, and invalid hosted/override targets fail before connection. The corrected fixture also passes all 32 cases in a clean full run and a shuffled seed-37 run. Original coverage is mapped in inventory.md.
- [x] T-3: Align pinned runners, local verification and CI stages
      Refs: R-3, R-4, R-6, P-1
      Depends: T-2
      Verify: One local full command matches CI, unique Python checks retained, failure diagnostics exercised.
      Evidence: Vitest 5.0.3 pinned; same named stages exposed through npm run verify and CI. All 35 Python, four hook and 12 release tests retained. Focused negative lint tests pass. A deliberately invalid remote browser target exits 1 before migration/seed/browser startup. Full npm run verify passed on 2026-10-05: strict lint/types/format/spec, 34 unit, 35 Python, four hooks, 12 release, 32 integration, build/generated consistency, one traced-build check and 21 Playwright cases. Independent review is tracked separately in T-5.
- [ ] T-4: Verify full browser journeys and exact-head protected preview
      Refs: R-2, R-4, R-5, P-1, P-2
      Depends: T-3
      Verify: Repeated clean-database runs, Playwright flow checks/screenshots, exact-head CI and automatic CMS preview.
      Evidence: All 21 Playwright cases pass, including the converted showcase/private-upload checks and unsaved template back navigation. One built trace test passes. Inspected mobile enquiry confirmation/showcase and desktop booking/template screenshots; horizontal overflow checks pass. Final exact-head CI/preview pending. The native cloud worker confirmed the first preview failed before build because Neon reached its database-branch limit; provider recovery is handled separately, with no test-worker resource mutations or paid upgrade.

- [x] T-5: Independently review correctness and maintainability
      Refs: R-6, P-1, P-2
      Depends: T-3
      Verify: Independent review of fixture lifecycle, preserved assertions, standards scope, CI parity and provider isolation; address findings without blanket rewrites.
      Evidence: Implementation self-review found and reproduced the partially initialized Payload pool leak; the fixture now owns its instance before init and the regression passes. An independent static reviewer covered fixture ownership/prerequisites/cleanup, preserved Python/hook/release assertions, migrated checks, CI stages/artifacts/retries and coding-rule scope. The sole blocker was provider-setting rehydration in child processes; synthetic subprocesses reproduced it for dotenv and Next, then passed with explicit inert settings and owned database URLs. The reviewer also requested preservation of the original showcase raw-HTML assertion, now restored. Full npm run verify passes after these changes. Independent re-review of 3fba8e1 confirms the provider reload blocker and raw-HTML preservation finding are fixed, with no new blocking regression. Its nonblocking wording note about the integration unpooled alias is clarified in the guide/design. Review was static; executed checks are the separate evidence above. User owns merge.
