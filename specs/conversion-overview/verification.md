# Conversion overview verification

Issue [#28](https://github.com/AxelOord/studio-lunia/issues/28) and its empty comment thread were
re-read on 2026-10-06, including immediately before publication. The body is unchanged since
2026-10-05 18:43:36 UTC. Subsequent owner implementation authorization supersedes its earlier
planning-only sentence. This slice starts at PR #41 review fix `d7021707` and targets verified
`develop` (`5f1669e8bb490b64e2bd5ee74a63878bea5f67fc`).

## Local verification

Node 24.19.0, pinned Payload 4.0.0-canary.37 / Next 16.3.8, PostgreSQL 17 and Chromium.
All fixtures are synthetic and owned by disposable local databases. New reporting credentials
are explicitly blanked before dotenv/Next loads, even when absent from the parent environment.
No provider credential, hosted data or customer transport is used.

`npm run verify` passed on 2026-10-06: static/generated checks, 44 unit tests, 89 integration tests,
35 Python checks, four hook tests, 12 release tests, one built-dependency test, production build and
all 42 Chromium journeys. Static checks were also rerun after the final native-form styling change.
The six new reporting unit cases, seven real database cases and two browser journeys are included
in that aggregate. All five saved screenshots were opened and inspected. The aggregate log is
`/tmp/lunia-conversion-verify.log`; the exact remote head/check results are recorded in the PR checkpoint.

- R-1/R-2: exact UTC boundaries, distinct intents versus linked contact IDs, repeated contact
  and same-email separate records, multiple proposals, old cohorts with later outcomes, idempotent
  commands, cancellations, payment/refund corrections and separate currencies. A 1,001-enquiry /
  1,001-booking fixture proves complete totals across keyset pages and the last source/group page.
- R-2: historical first/last snapshots survive browser expiry and PostgreSQL JSONB key reordering.
  Withheld/unknown sources remain separate; returned report data excludes click IDs and contact/form
  markers. Native ledger drilldowns are verified against the exact matching payment record.
- R-3: staff attestation rejects missing confirmation, invalid/future/pre-enquiry times and bad
  reasons. Correction, clear and old-key retry preserve the latest authoritative response. Automation
  and incoming replies do not count. Current published occupancy preserves pending/older overlapping
  commitments beneath a newer private draft and identifies commitments outside inventory.
- R-4: anonymous and conditional-source access are denied before aggregate reads. Browser coverage
  exercises source focus, keyboard disclosure, response correction/clear, retained filters, empty
  denominators, failed-read recovery, native money links, mobile table keyboard scrolling and document
  overflow. Private admin journeys produce no measurement calls or JavaScript errors.
- R-5: no provider request by default or with missing/unsafe configuration; fixed EU query/host;
  bounded counts-only output; incomplete, misordered, invalid, oversized and failed responses remain
  unavailable. Provider people/properties/error details are discarded.

## Visual evidence

Five actual Chromium screenshots cover desktop reporting, mobile outcomes, campaign-table scrolling,
native first-response recording and an empty mobile cohort. Visual QA corrected a hidden accessibility
label escaping the table scroll container and applied the existing form styling to the native response
control. The table remains independently scrollable; the document stays within a 390-pixel viewport.
No test timeout, retry count, rate limit or security assertion was weakened.

- [Desktop overview](evidence/conversion-overview-desktop.png)
- [Mobile outcomes](evidence/conversion-funnels-mobile.png)
- [Mobile campaign breakdown](evidence/conversion-breakdown-mobile.png)
- [Mobile response control](evidence/conversion-response-mobile.png)
- [Empty mobile cohort](evidence/conversion-empty-mobile.png)

## Remaining acceptance gates

The issue stays open. Exact published SHA, terminal CI and the automatic deployment result belong
in the draft PR/checkpoint. The previously verified Neon 10/10 branch limit blocks new hosted CMS
acceptance; normal Git preview results are inspected without provisioning retries, deletion or upgrades.
No hosted success is inferred from local tests.

PostHog remains unconfigured and reporting disabled. Owner approval of the exact EU project, terms,
project access and a project-restricted Query Read credential is required, followed by secure provider-UI
handoff and hosted consent/no-consent/withdrawal verification. Studio visitor/booking steps remain
explicitly uninstrumented; no visitor-to-booking rate is claimed. There is no matched spend, customer
email activation, payment collection, production deployment or live experiment.

Metric definitions and the precise provider handoff are in [the runbook](../../docs/conversion-overview.md).
