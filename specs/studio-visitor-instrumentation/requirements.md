# Studio visitor instrumentation — requirements

Workflow: requirements-first
Status: ready

## Goal and scope

Complete the missing visitor events for issue #28 on PR42's reporting/studio foundation.
Keep bespoke and studio journeys separate. Use the existing consent-aware PostHog EU
transport, with measurement and reporting disabled by default. Do not activate the reader,
change credentials, experiment taxonomy (#14), bookings, payments or customer delivery.

## Acceptance criteria

### R-1: Meaningful stages and bounded data

WHEN a consenting visitor sees a published studio-day heading, selects an offered time or
successfully creates a reservation, the system SHALL emit respectively studio_day_viewed,
studio_slot_selected and studio_booking_submitted. The completion SHALL distinguish initial
confirmed/pending_approval status. No personal data, form content, slot/session time, record
identity, title, full URL, campaign tags or click IDs SHALL be included in provider properties.
Check: exact payload assertions and browser requests; draft, staff and forged completion denial.

### R-2: Consent and deduplication

WHEN measurement is absent, declined, withdrawn or unconfigured, the system SHALL suppress
collection. Withdrawal SHALL abort queued browser requests and prevent submission capture via
its explicit permission flag. Only current visible exposure after consent may be observed;
earlier selections/submissions SHALL never be replayed. Each anonymous session/day/step SHALL
have a stable identity and persistent atomic claim. Retries and staff changes SHALL not create
completion events. Optional failure SHALL never fail a committed booking.
Check: concurrent claims, ambiguous failures, booking retries, delayed/failed withdrawal and
new-session retry tests without live provider calls.

### R-3: Honest coverage and compatibility

WHEN staff inspect reporting, labels SHALL explain that studio capture exists but aggregate
reading is not connected; no rate or zero SHALL be invented. Document session/day denominators,
missing events, initial booking status and the independent reader activation dependency.
Existing service events, privacy boundaries and old photography site SHALL remain unchanged.
Check: unchanged bespoke contracts and visible reporting/privacy labels.

### R-4: Verification and handoff

WHEN delivering, the change SHALL include full repository verification, actual desktop/mobile
browser flows and inspected screenshots, a focused draft PR, exact-head CI and explicit hosted
limits. Inspect existing tickets before adding approved follow-up gaps. No provider retries,
branch deletion, upgrades, merge or real messages SHALL occur.
Check: recorded commands, screenshots, ticket audit and exact commit/PR/check links.

## Open questions

None for capture. Reader integration/activation and hosted acceptance remain separate work.
