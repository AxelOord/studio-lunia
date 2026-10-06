# Experiment groundwork — verification

## Scope and reviewed evidence (2026-10-06)

Base: PR #42, `8aa1c1bf2948a023d64899576ee779072f7d2066`. Issue #14 remains open:
this is disabled groundwork; agreed live baseline/sample and hosted acceptance are future work.

- Three unit cases: stable split assignment, zero/tiny-sample Wilson bounds, old consent does not authorize experiments.
- Nine isolated PostgreSQL cases (including migration preservation/reversal): private authoring, disabled/default runtime, published eligibility, frozen design and concurrent writes, deterministic concurrent assignment, exposure/outcome retry deduplication, newly committed enquiry gating, revocation races including first assignment, expiration, wrong service, draft isolation, changed/unpublished landing rejection, stopped-state behavior, retained draft preservation and conditional-access denial. One test temporarily exercises the live gate only within its owned local database.
- Three production Chromium journeys: desktop consent/real enquiry with lost-response retry, mobile withdrawal/other-tab pause/delayed-response rejection, and native private authoring/stop/retain-to-draft. Synthetic records and separate simulation mode only; no provider request.

Screenshots were captured from the actual application and inspected before and after styling:
`evidence/experiments-desktop-results.png`, `evidence/experiments-mobile-results.png`,
`evidence/experiments-desktop-plan.png`, `evidence/experiments-desktop-landing.png`,
`evidence/experiments-mobile-withdrawn.png`. Cards, CTA hierarchy, keyboard focus,
mobile wrapping and explicit small-sample limitations are legible. The optional API's
visibility check correctly did not count a CTA below/above the current viewport.

## Failures resolved during development

- The restored environment had an initial repository checkout and an unwritable default npm cache.
  Fetched the specified dependency commit and installed the unchanged lockfile with a local temporary cache.
- Payload create hooks supply an empty original document; lifecycle freezing now only reads a previous record on update.
- Corrected strict TypeScript handling of unsuccessful enquiry results and native denied-access assertions.
- Browser fixtures now scroll the real CTA into view before expecting exposure, wait for privacy initialization,
  use Payload's required-field accessible label and distinguish the form alert from Next's route announcer.
- The legacy landing migration fixture now applies later migrations before using the current runtime schema; all original up/down preservation assertions remain, and a dedicated experiment rollback guard test was added.
- Final review trims CTA authoring input so whitespace cannot create an empty actionable variant; unavailable reports do not claim the runtime is disabled.
- The full browser suite exposed shared localhost rate-limit consumption. New fixture cleanup subtracts only its own completed enquiry attempts; the production 20-attempt limit and all existing assertions are preserved. The original failure was documented before the corrected run; its temporary local trace/log were lost when the execution environment restarted.
- Recovery found a second browser failure: Payload had not mounted an offscreen nested service field in the existing editor journey. The test now scrolls its actual row into view; all five page-management journeys passed without changing assertions or timeouts. Its error context and trace are retained in ignored `test-results/recovery-page-management-failure/`.
- An initial privacy read now ignores responses arriving after a local or other-tab consent change, preserving the paused state.
- Screenshot review replaced unstyled result containers with the existing workspace cards and spaced actions.

These were explained fixes before reruns; retries remain zero and existing tests are preserved.

## Aggregate and remote checkpoint

Full `npm run verify` passed after recovery: static/generated checks, 47 unit tests,
98 PostgreSQL integration tests across 17 files, 35 Python tests, 4 hook tests, 12 release
tests, production build, 1 built-dependency test and all 45 Chromium journeys. Retries remain zero.
The aggregate log is saved in ignored `test-results/overnight-verify.log`.

Exact-head CI and the single automatic preview outcome will be recorded in the draft PR body,
keeping remote evidence attached to the immutable implementation commit. Publication is pending
at this source checkpoint.
Neon was independently verified at 10/10 preview branches; do not retry provisioning, delete
branches or change settings. Local/CI success is not hosted acceptance. No live launch,
merge, credentials, provider activation, customer email, payment or old-site change is performed.
