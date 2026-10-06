# Conversion overview — requirements

Workflow: requirements-first
Status: ready

## Goal and scope

Implement [#28](https://github.com/AxelOord/studio-lunia/issues/28), re-read with empty comments
on 2026-10-06. Subsequent owner implementation authorization supersedes its planning-only sentence.
Build on PR #41 fix d7021707. No email/payment activation, new capture events, credentials, Ads spend,
live experiment, paid services or production change.

## Acceptance criteria

### R-1: Explicit cohorts and honest outcomes

The report SHALL default to the last 30 inclusive UTC calendar days, accepting at most 366 days.
Bespoke cohorts use enquiry creation; studio cohorts use booking creation. Evaluate current outcomes
and all signed ledger entries for those cohorts as of the report snapshot, even outside the creation
period. Qualification means a recorded bespoke proposal; converted enquiries have a currently
confirmed/completed booking. Count distinct enquiry/booking IDs and show linked unique contacts
separately; matching emails never infer identity. Cancellation rate is cancelled / (confirmed +
completed + cancelled); pending/proposed are excluded and zero denominators are unavailable.
Check: exact boundaries, repeated contacts, multiple proposals, retries, late outcomes, cancellations.

### R-2: Monetary and attribution integrity

Expected value SHALL sum confirmed/completed bookings; recorded net payments SHALL sum payments,
refunds and correction reversals, including cancelled bookings, separately per entry currency.
This is staff-recorded money, not bank-verified collection, profit or accrual revenue.
Service, current agreed studio-day and first/last campaign groups SHALL preserve withheld, unknown,
direct, untagged and tagged-but-unidentified buckets. Frozen historical attribution does not expire
with browser cookies. Return no click IDs. Missing matched spend means unavailable cost per booking.
Complete totals SHALL NOT inherit recent-list limits; source records and breakdowns are paginated.
Check: corrections, currencies, old campaigns, minimization and complete source reconciliation.

### R-3: Defined response and occupancy measures

First human response SHALL use a staff-attested first personal outbound timestamp. Automated receipts,
drafts and customer replies are not evidence. Corrections/clears append history; the latest attestation
is authoritative. Show median elapsed hours only among recorded responses, with responded/all coverage.
Occupancy SHALL count allocated current published slot-places / current published capacity for sessions
starting in the selected UTC period. Include overlapping old-revision commitments and pending approvals;
cap allocation per slot and show active commitments outside current inventory separately. This is current
inventory as of the snapshot, not reconstructed historical capacity or the creation-cohort denominator.
Check: invalid/corrected/cleared response dates, revised/draft inventory, pending places and moves.

### R-4: Useful, private, responsive reporting

Payload SHALL show current all-date new enquiries, waiting follow-ups, upcoming confirmed bookings,
email and notification failures with source links, separately from cohort metrics. Retain filters,
explain denominators, and provide exact private source drilldowns plus empty/loading/error recovery.
Authenticate before reads, enforce source-collection access and disable caching. Send no customer
details, form text or email contents to analytics.
Check: anonymous/conditional-access denial, desktop/mobile/keyboard, source links and error recovery.

### R-5: Honest optional analytics

The EU PostHog read adapter SHALL stay off by default and request only aggregate counts for the existing
service-view → enquiry-start → enquiry-submit sequence, ordered within 24 hours across services.
Counts describe opted-in anonymous sessions, not people or Payload cohorts. Missing consent/blocking
means incomplete coverage; do not join identities or infer visitor-to-booking conversion.
Studio visitor steps remain explicitly uninstrumented. Unconfigured, incomplete and failed responses
mean unavailable, not zero. No new capture, replay, SDK or credential is introduced.
Activation requires owner approval and secure provider-UI handoff of an EU project ID and a project-scoped
query:read credential, separately from the ingestion token.
Check: no default request, fixed host/query, bounded/minimized response, redaction and invalid results.

### R-6: Reviewable implementation

The change SHALL pass aggregate tests and exact-head CI, include inspected screenshots and a focused
draft PR into verified develop. Record the normal automatic preview result without retrying provisioning
at the verified Neon 10/10 branch limit. Keep the issue open while hosted/analytics acceptance is incomplete.
Check: source reconciliation, aggregate log, exact SHA/CI/deployment and independent review checkpoint.

## Decisions

Use these conservative definitions without another spec-approval round. Provider activation and future
studio instrumentation need separate approval; neither blocks local implementation or synthetic tests.
