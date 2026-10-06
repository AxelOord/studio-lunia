# Studio-day verification

Issues [#26](https://github.com/AxelOord/studio-lunia/issues/26) and
[#27](https://github.com/AxelOord/studio-lunia/issues/27) were re-read with their empty comment threads
on 2026-10-06. Their bodies remain unchanged since 2026-10-05 18:43 UTC. The owner-authorized
overnight scope supersedes their earlier wait-for-approval wording.

## Local acceptance

Review fixes and their regression tests are committed with this evidence. The exact branch head
and remote check results are recorded in [PR #41](https://github.com/AxelOord/studio-lunia/pull/41).
Verification uses Node 24.19.0, the pinned dependency lockfile, PostgreSQL 17 and Chromium, with
owned disposable local databases and synthetic fixtures. `npm run verify` runs the same named
application/tooling stages as CI. Final aggregate result and screenshots are recorded below.

`npm run verify` passed on 2026-10-06 after the independent review fixes: static/generated checks,
38 unit tests, 82 integration tests,
35 Python checks, 4 hook tests, 12 release tests, one built-dependency test, production build and
all 40 browser tests. The aggregate log is `/tmp/lunia-studio-review-verify.log` in the execution
environment; no failing test is suppressed. Earlier acceptance at `1e0ab587` passed 76 integration
and 37 browser cases but did not detect the independent review findings below.

- R-1: native draft editing and publishing, anonymous preview denial, required operational inputs,
  immutable slot revisions, explicit acknowledgement and preserved existing commitments.
- R-2: desktop/mobile offer, booking form, receipt and honest unavailable states; labels, focus
  after errors/success, retained input, and no horizontal overflow.
- R-3: eight simultaneous public/staff contenders for one place; raw SQL allocation guards;
  overlapping revisions; idempotent lost-response retries/conflicts; pending capacity; no selection
  hold; cancellation release and atomic failed moves.
- R-4: concurrent cross-day moves, stale booking/day revisions, timezone/DST gaps and repeated times,
  buffers and deadlines. Rescheduling uses published facts even beneath a newer private draft.
- R-5: enquiry-free customer handoff, frozen dated history, post-commit message failure/retry,
  obsolete draft/job cancellation, and approved preparation rules only after confirmation.
  Existing enquiry proposals, manual money records and private email regressions remain covered.
- R-6: no-consent and tagged visits, in-flight consent withdrawal while the old signed cookie exists,
  top-level campaign minimization, private availability and no new analytics or visitor email calls.

The studio additions include 20 database integration cases, one migration preservation/up-down-up
case, two time/currency unit cases and eight actual Chromium journeys. Existing security, fixture
isolation, migration, uploads, enquiry, follow-up and workspace suites run in the same aggregate.

## Visual evidence

The original eight actual Chromium screenshots and two additional review-regression screenshots
were opened and inspected.
The public offer precedes slot selection; mobile labels, conditions and receipts remain readable.
The editor and customer workspace show confirmation mode, capacity, pending decisions and private
test-message boundaries without horizontal overflow. The sold-out view offers another studio day.
Styling and sample content remain provisional pending the owner's genuine assets and copy.

- [Public desktop](evidence/studio-day-desktop.png) and [public mobile](evidence/studio-day-mobile.png)
- [Mobile receipt](evidence/studio-receipt-mobile.png) and [sold-out recovery](evidence/studio-sold-out-mobile.png)
- [Staff desktop](evidence/studio-admin-desktop.png) and [staff mobile](evidence/studio-admin-mobile.png)
- [Native editor](evidence/studio-native-editor.png) and [native mobile editor](evidence/studio-native-editor-mobile.png)
- [Sequential staff bookings](evidence/studio-staff-repeat.png) and [mobile shifted-session replacement](evidence/studio-shifted-reschedule-mobile.png)

## Defects reproduced and corrected

The expanded browser suite reproduced a newer private draft removing a still-published day from
the reschedule chooser. Its regression now verifies both availability and the original published
location. A newly added JSON field also attempted to load a remote code editor in the legacy
booking screen; it now uses the existing inert private snapshot display. The existing browser
error assertion is preserved. A native-CMS cancellation regression also reproduced nested/default
form submission remounting the record without saving the cancellation. Studio actions now use
explicit buttons and a group, with no nested form. The regression checks the durable cancellation
even when the following record refresh fails; that refresh error remains visible.

Native publish and staff-selection tests use the actual responsive CMS button/accessibility names.
No test timeout, retry count, security assertion or rate limit was weakened.
The legacy migration fixture registers the new relationships without changing preservation assertions.

Independent review of `23a1d8f` identified four additional booking defects and a CI timeout.
Regression tests against the original build reproduced the checked agreement surviving refreshed
terms and the staff form remaining disabled with no way to start another booking. A real PostgreSQL
test reproduced the second schedule revision becoming 11 instead of 2. Public agreement is now
controlled and clears when terms refresh or the chosen session changes, retaining name/email.
Staff deliberately start another booking with a reset form and a fresh submission identity.
PostgreSQL NUMERIC revisions are converted to validated safe integers before incrementing; tests
publish 18 times and reject fractional, negative and exhausted/unsafe revisions atomically.

Replacement availability previously counted the booking being moved, preventing a capacity-one
booking from selecting an overlapping replacement. The authenticated availability path reads the
active booking with the actual user's access before excluding that one allocation. Tests preserve
other allocations, original snapshot/history and transaction checks; anonymous replacement requests
return 401, and a public exclusion parameter cannot alter capacity. A mobile browser flow moves to
a shifted, longer session successfully.

Foundation run `37395961261` failed the unchanged 20-second preview-build safety test. Its five
subprocesses eagerly imported the entire CMS bootstrap before configuration validation; that import
alone took 2.8 seconds locally. Loading bootstrap only after validation, connection and migrations
removes that work from rejection paths. The same safety test passed in 0.834 seconds in the final
full aggregate, retaining all error-redaction assertions and original timeouts.

## Review and hosted gate

This branch builds on PR #40 application/evidence head `ff0cc420`, which already includes #39/#38.
The target `develop` was fetched and verified at `5f1669e8bb490b64e2bd5ee74a63878bea5f67fc`.
Review the focused branch delta from `ff0cc420`; earlier dependent work is not reimplemented here.

Independent re-review and hosted acceptance remain open. The parent verified Neon at 10/10 branches
and authorized draft publication with this explicit gate. The prior automatic deployment at
`23a1d8f`, `dpl_HcgC7CCYDunKBpGhaCGHpEm11yJ9`, failed with "Resource provisioning failed".
Record the normal automatic deployment for the review-fix commit and exact-head CI in the PR.
Do not retry provisioning, delete branches, upgrade or change provider
settings. This evidence does not claim a working hosted booking flow. The migration refuses rollback
when studio-day data exists; existing commitments must be preserved explicitly.

All email output is private test drafts/simulation. No customer transport, paid service, Ads feedback,
PostHog configuration, credential provisioning, production deployment or merge is part of this batch.
Real venue, offer values, photographs and commercial policy copy remain owner-provided inputs.
