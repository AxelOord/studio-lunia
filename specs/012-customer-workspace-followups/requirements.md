# Customer workspace and safe follow-up planning — requirements

Workflow: requirements-first
Status: ready

## Goal and scope

Implement the owner-approved #35/#25 batch after the #36 foundation's blocking review
findings are resolved. Current bodies and comments were fetched on 2026-10-05; neither
ticket has comments. Staff need one route from an enquiry to its customer, proposal,
email preview and planned follow-ups. Reuse the private records from #10/#23/#24.

Build the queue, stop rules, incoming-reply adapter and job execution in disabled/test
mode. Actual inbound access, live delivery and unattended scheduling require separate
provider/content/runner approval and verification. No production change, mailbox-wide
sync, paid upgrade, promotional sequence, abandoned-form mail, payments, calendar
capacity, studio-day booking, public landing page #33 or analytics expansion.

## Acceptance criteria

### R-1: A useful enquiries inbox (#35)

The admin home SHALL show customer, service, status, last activity and the next useful
action, with new/waiting/upcoming/attention filters, bounded search and clear loading,
empty and failure states. Names/contact details SHALL stay out of search URLs.
Check: empty/populated/filtered inbox, pagination, stale responses and failed/retried reads.

### R-2: One customer workspace (#35)

Opening an enquiry SHALL retain its customer context while showing the original request,
chronological conversation/activity, booking, email snapshots and planned follow-ups.
Staff SHALL prepare a reply/proposal, review exact email content, update booking state
and return to the inbox without navigating raw collections for the main journey.
Check: complete enquiry-to-proposal-to-private-draft-to-follow-up flow; multiple enquiries
per contact, original snapshots and explicit contact linkage remain distinguishable.

### R-3: Clear actions and accessible recovery (#35)

Actions SHALL have explicit save/cancel/back behavior, pending feedback, stable retry
identity and useful errors. Unsaved cancellation SHALL not mutate records. Desktop and
mobile SHALL have readable amounts/dates, labelled controls, keyboard access and visible
focus. Test-only sending and unavailable reply detection/automation SHALL be explicit.
Check: keyboard and responsive browser journey, repeated clicks, back/cancel, expired
session, validation failure, failed load/write retry, no overflow or console errors.

### R-4: Reviewable planned messages (#25, #35 entry points)

Staff SHALL see each planned message's customer, purpose, source enquiry/booking,
planned instant and timezone, exact subject/body/recipient, status and blocking reason.
They SHALL edit, pause, cancel, resume or reschedule eligible plans with dated history.
Editing a pending plan SHALL create a revision; prepared/sent email snapshots stay immutable.
Check: edit/cancel/reschedule, stale revision conflict, invalid or ambiguous time inputs,
unchanged frozen email, clear overdue/blocked/failed and empty states.

### R-5: Explicit triggers and conservative stop rules (#25)

Approved test-planning rules SHALL create each trigger/revision once. Suggested timings
are unapproved examples, never active defaults. No-response follow-ups SHALL stop on a
later reply, booking, refusal, closure, applicable opt-out, pause or delivery problem.
Session reminders SHALL require the current confirmed session; changes replace obsolete
plans and late bookings cannot create a burst of overdue reminders. Missing reliable
reply detection SHALL block unattended no-response work rather than imply silence.
Check: repeated/concurrent trigger, later reply, booking/cancel/reschedule, opt-out,
relink, stale template and failed/delayed/bounced/uncertain delivery matrices.

### R-6: Genuine reply provenance with unavailable integration blocked (#25)

A narrowly scoped incoming adapter SHALL verify event authenticity and match only the
approved reply route and unambiguous conversation identity. Duplicate replies SHALL be
idempotent; unknown/conflicting matches require staff review. Manual known-reply notes
SHALL stay labelled as staff reports. The production-facing receiving route SHALL stay
disabled until exact provider access, address and protected ingress are approved.
Check: signed synthetic events, forgery/expiry/oversize, wrong route, unknown/conflicting
match, reordered duplicates and downstream stop rules; no real inbox/provider access.

### R-7: Durable jobs recheck eligibility (#25)

Payload's persistent jobs SHALL reference plan ID/revision, re-read all stop conditions
immediately before simulated dispatch, and ignore obsolete revisions. Retries and lease
recovery SHALL preserve a stable delivery identity and exact content; duplicate/concurrent
runs cannot create duplicate outcomes. Cancellation races SHALL have a truthful result:
cancelled before handoff, or already committed/uncertain and requiring review.
Check: real PostgreSQL transactions, concurrent run/cancel/reply/booking races, worker
failure and recovery, bounded retries, overdue work, immutable payload and safe errors.

### R-8: No accidental live activation (#25)

Preview/local job execution SHALL simulate delivery and make no provider send call.
Live customer sending SHALL remain disabled even if a client forges a mode flag. A
manual staff test action may exercise due jobs, but is not an automatic runner. The UI
and runbook SHALL distinguish planned time from verified dispatch timing and list exact
activation decisions: wording, triggers/business days, timezone, reply route/access,
runner/limits/tolerance and outage recovery. No marketing permission is inferred.
Check: no outbound network in simulation, unauthorized/direct jobs denial, unavailable
runner and inbound states, explicit provider blockers and no optimistic delivery claims.

### R-9: Preserve privacy, access and existing records

All customer content, plans and reply data SHALL remain staff-only and absent from
analytics/public pages. Reuse bounded validation, safe errors, transaction/idempotency
helpers and shared authorization. Additive migrations SHALL preserve historical enquiries,
attribution, booking/value records and email/delivery facts. Synthetic data only in tests.
Check: anonymous/forged capability/origin denial, migration/backfill preservation,
existing regression suites, minimized job/event input and no tracking requests.

### R-10: Reviewable batch delivery

Deliver traceable specs, focused commits and draft PR(s), aggregate isolated tests,
inspected desktop/mobile screenshots, independent review, exact-head CI and protected
full-CMS preview. Preserve #37's test foundation and unrelated workflow/release work.
Check: npm run verify, selected/shuffled/concurrent cases, screenshot QA and exact SHA.

## Open choices and safe implementation defaults

No separate specification approval is needed. The owner already approved implementation.
Keep all example triggers inactive and all queued execution simulated. Require explicit
timezone/time/content review; do not choose business hours, working days or live wording.
Dedicated inbound address versus narrowly scoped mailbox access and the actual production
runner remain activation decisions. #25 cannot claim hosted inbound/dispatch acceptance
until these are approved and proved; implementation alone does not close the ticket.
