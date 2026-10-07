# Privacy save race — verification

Base: combined PR #45 head `b687d7e8fcaf791586e487989fa50f99322930bb`.
The independent reviewer reproduced an older consent POST changing permissions back to true
following another tab's withdrawal. This is separate from the previously covered stale-GET case.

## Before and after evidence

- Ran the new real two-tab regression against the unchanged pre-fix production build. It failed
  at the required waiting-withdrawal boundary: no cross-tab privacy request was queued behind
  the held grant. Log: ignored `test-results/privacy-race-before.log`; context/trace retained in
  `test-results/privacy-race-before-evidence/`. No screenshot was re-downloaded or re-inspected.
- Static checks and production build passed with the fix.
- The first focused run passed 17 cases and found one legacy mobile timing assumption: it
  checked cookie deletion after immediate UI pause, before the successful withdrawal response.
  The case now observes both immediate pause and actual successful persistence before checking
  cookies. No assertion, timeout or retry was weakened. Failure evidence remains in ignored
  `test-results/privacy-race-mobile-timing-evidence/`.
- All 18 focused experiment/studio journeys then passed. Command:
  `npm run test:e2e -- tests/e2e/experiments.spec.ts tests/e2e/studio-days.spec.ts --project=chromium`.
  Log: `test-results/privacy-race-focused-fixed.log`.

The overlap case holds a real successful grant response, waits for a second tab's queued
withdrawal and proves no withdrawal HTTP request departs early. It checks denied local controls,
no resumed optional requests, the newly issued identity in withdrawal's Cookie header, removal
of all optional cookies, denied signed preferences, the database revocation tombstone, rejection
of replayed old grant cookies, and a fresh later grant with stable repeat assignment/exposure.
Readiness/collector responses are simulated only in the browser; provider capture stays disabled.

A separate browser case removes navigator.locks and verifies no privacy POST/experiment identity
is created, the unsaved-choice error remains honest and the enquiry form still opens. Existing
stale-GET cases release the held read before awaiting save completion, preserving their checks
while accounting for the new ordered request protocol. Studio completion/deduplication and
experiment concurrency tests remain part of full verification.

## Aggregate and remote checkpoint

Full `npm run verify` completed successfully before the environment interruption: static and
generated-file checks, 50 unit tests, 103 PostgreSQL integration tests, 35 Python tests, 4 hook
tests, 12 release tests, production build, 1 built-dependency test and all 52 Chromium journeys.
The saved log is `test-results/privacy-race-verify.log`; unit/integration/build JUnit reports
have zero failures/errors and the browser last-run report is passed. On 2026-10-07 the preserved
worktree, complete log and remote base b687d7e were checked before resuming publication; the
completed aggregate was not repeated. Browser retries remain zero.

Exact-head CI is pending publication and will be recorded in the PR conversation. The existing PR #45 branch will be reused;
no live activation, PR merge, provider setting change or schema/access workaround is authorized.
One normal automatic preview outcome will be recorded; the known Neon 10/10 limit remains a
hosted-acceptance blocker and is not retried or changed. Live baseline/power/stopping, retention,
consent review and owner launch approval remain unresolved.
