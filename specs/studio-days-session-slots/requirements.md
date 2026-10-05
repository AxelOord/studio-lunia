# Studio-day pages and session slots — requirements

Workflow: requirements-first
Status: ready

## Goal and authorized scope

Implement the owner-authorized studio-day journey in [#26](https://github.com/AxelOord/studio-lunia/issues/26)
and [#27](https://github.com/AxelOord/studio-lunia/issues/27). Current bodies and empty comments were
fetched on 2026-10-05. Later overnight authorization supersedes the older wait-for-approval text.
Build separately from bespoke enquiries, on the completed #33 branch (PR #40, dependent on #39/#38).
A photographer rents a studio for specific days; customers reserve a session with her.

No online payments/deposits, customer self-service changes, external calendars, live messaging,
new providers/credentials, Ads feedback, analytics events, production or commercial policy guesses.
Use approved existing blocks/photos when provided, and clearly synthetic local/preview examples.

## Acceptance criteria

### R-1: Editable, private-to-published studio days

Staff SHALL configure location, local date/IANA timezone, offer/inclusions, duration, price/currency,
hours, buffer, per-slot capacity, booking deadline and change-policy wording. Business inputs have
no invented defaults; confirmation defaults to immediate and can be manual per day. Native drafts
and preview SHALL remain private; publishing, closing bookings and cancellation are explicit.
Check: native editor, required publication fields, draft denial/preview, reusable blocks and migration.

### R-2: Clear public session journey

A published day SHALL have a shareable page showing its offer, local date/timezone, location,
price/inclusions and conditions before one primary slot-selection action. Available, past, closed,
cancelled and sold-out states SHALL give honest next steps. The form asks name/email and agreement
to the displayed conditions only, separate from optional tracking. Immediate versus pending approval
and the no-payment/no-visitor-email preview boundary SHALL be explicit on form and receipt.
Check: keyboard/mobile flow, error recovery, all states and no customer data in public availability.

### R-3: Transactional capacity and idempotency

Public and staff reservations SHALL use the same database transaction and capacity authority.
Concurrent submissions, repeated/lost-response retries, stale day revisions and overlapping slots
across schedule revisions SHALL not overbook. A reused identity with changed input SHALL conflict.
Selecting a slot creates no temporary hold or database reservation; abandonment cannot reduce capacity.
Pending approval consumes one place until explicit staff approval/cancellation; no expiry is assumed.
Check: concurrent public/staff/overlapping reservations, duplicate keys, rollback, stale revision,
manual pending capacity, approval without extra allocation, cancellation release and abandonment.

### R-4: Preserve existing commitments

Bookings SHALL freeze time/end/buffer, timezone, location, offer, price, policy, confirmation mode and
attribution. Publishing affected settings with active bookings SHALL require explicit acknowledgement
and preserve existing statuses/snapshots. New availability SHALL respect existing occupied intervals.
Staff rescheduling/cancellation SHALL use revision checks, a reason and reviewed replacement details;
rescheduling rechecks target capacity and preserves pending/confirmed status until an explicit decision.
Check: settings changes, simultaneous edits, cross-day moves, failed move rollback and dated history.

### R-5: One private customer record and safe messaging

Studio bookings SHALL appear in the existing Contacts/Bookings/history workspace without creating a
bespoke enquiry. Existing enquiry-led records remain usable. Confirmation/approval/change/cancellation
messages SHALL be private frozen test drafts, with obsolete drafts/reminders disabled and failures
visible/retryable without losing or duplicating the booking. Confirmed sessions alone may create
approved #25 preparation/reminder simulations; pending approval SHALL never create those sequences.
Check: customer handoff, no visitor transport calls, failed preparation/retry, reminder replacement,
private access denial and complete existing enquiry workflow regressions.

### R-6: Correct time and privacy

All slots SHALL use explicit IANA timezone and UTC instants; nonexistent DST local times are rejected
and repeated times require an explicit offset. Customer displays include timezone/offset where needed.
Consent-aware first/last campaign snapshots reuse #11; no names, email or conditions enter analytics.
Unknown/withdrawn consent SHALL allow booking while withholding optional attribution.
Check: DST gap/fold, buffer boundaries, expired deadlines, tagged/no-consent/withdrawal journeys.

### R-7: Reviewable verified delivery

Deliver specs, focused commits/draft PR, actual issue links, aggregate tests, independently reviewed
code, inspected desktop/mobile screenshots, exact-head CI and hosted checks when provider capacity
allows. Neon is verified 10/10; publishing is authorized with that explicit non-merge-ready gate.
Never retry provisioning, delete provider data, upgrade, or mutate provider/security settings.
Check: coherent local implementation/tests, draft and evidence, honest remaining hosted blockers.

## Safe policy decisions

No temporary holds. Pending requests allocate capacity indefinitely until staff act; the UI states
this and exposes pending review. No automatic cancellation or expiry, payment/deposit policy, refund
calculation or customer self-service changes. All offer/timing/change conditions require explicit staff
input before publishing. Real commercial copy, imagery and policies remain owner inputs.
