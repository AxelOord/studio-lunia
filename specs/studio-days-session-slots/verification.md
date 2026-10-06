# Studio-day verification

Issues [#26](https://github.com/AxelOord/studio-lunia/issues/26) and
[#27](https://github.com/AxelOord/studio-lunia/issues/27) were re-read with their empty comment threads
on 2026-10-06. Their bodies remain unchanged since 2026-10-05 18:43 UTC. The owner-authorized
overnight scope supersedes their earlier wait-for-approval wording.

## Local acceptance

Application and test head: `1e0ab58775f8d89c0b24ce074bc9ea12ec4c44f8`.
Verification uses Node 24.19.0, the pinned dependency lockfile, PostgreSQL 17 and Chromium, with
owned disposable local databases and synthetic fixtures. `npm run verify` runs the same named
application/tooling stages as CI. Final aggregate result and screenshots are recorded below.

`npm run verify` passed on 2026-10-06: static/generated checks, 38 unit tests, 76 integration tests,
35 Python checks, 4 hook tests, 12 release tests, one built-dependency test, production build and
all 37 browser tests. The final evidence commit changes documentation/images only. The aggregate
log is `/tmp/lunia-studio-verify-6.log` in the execution environment; no failing test is suppressed.

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

The studio additions include 14 database integration cases, one migration preservation/up-down-up
case, two time/currency unit cases and five actual Chromium journeys. Existing security, fixture
isolation, migration, uploads, enquiry, follow-up and workspace suites run in the same aggregate.

## Visual evidence

All eight actual Chromium screenshots from the passing aggregate were opened and inspected.
The public offer precedes slot selection; mobile labels, conditions and receipts remain readable.
The editor and customer workspace show confirmation mode, capacity, pending decisions and private
test-message boundaries without horizontal overflow. The sold-out view offers another studio day.
Styling and sample content remain provisional pending the owner's genuine assets and copy.

- [Public desktop](evidence/studio-day-desktop.png) and [public mobile](evidence/studio-day-mobile.png)
- [Mobile receipt](evidence/studio-receipt-mobile.png) and [sold-out recovery](evidence/studio-sold-out-mobile.png)
- [Staff desktop](evidence/studio-admin-desktop.png) and [staff mobile](evidence/studio-admin-mobile.png)
- [Native editor](evidence/studio-native-editor.png) and [native mobile editor](evidence/studio-native-editor-mobile.png)

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
No test timeout, retry count, security assertion or rate limit was weakened. The existing preview
validation timeout was fixed by deferring the new seed import until after configuration validation.
The legacy migration fixture registers the new relationships without changing preservation assertions.

## Review and hosted gate

This branch builds on PR #40 application/evidence head `ff0cc420`, which already includes #39/#38.
The target `develop` was fetched and verified at `5f1669e8bb490b64e2bd5ee74a63878bea5f67fc`.
Review the focused branch delta from `ff0cc420`; earlier dependent work is not reimplemented here.

Independent review and hosted acceptance remain open. The parent verified Neon at 10/10 branches
and authorized draft publication with this explicit gate. Record the single automatic deployment
and exact-head CI in the PR. Do not retry provisioning, delete branches, upgrade or change provider
settings. This evidence does not claim a working hosted booking flow. The migration refuses rollback
when studio-day data exists; existing commitments must be preserved explicitly.

All email output is private test drafts/simulation. No customer transport, paid service, Ads feedback,
PostHog configuration, credential provisioning, production deployment or merge is part of this batch.
Real venue, offer values, photographs and commercial policy copy remain owner-provided inputs.
