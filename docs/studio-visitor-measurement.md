# Studio visitor measurement

Issue #28's public studio journey uses the existing signed consent session, same-origin
collector, fixed PostHog EU capture endpoint and persistent event claims. Capture remains
off until the existing approval/configuration gates are met. No credentials, provider settings,
SDK, replay or experiment events are added. Bespoke event names/payloads stay unchanged.

| Event                      | Meaning                                                                                                                                        | Source                                                        |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `studio_day_viewed`        | At least half the published day heading is currently visible while consent and configuration are ready. Published unavailable days also count. | Browser visibility observer                                   |
| `studio_slot_selected`     | Visitor chooses a currently offered time with remaining capacity. This creates no hold.                                                        | Browser selection; collector checks public bookable inventory |
| `studio_booking_submitted` | A new visitor reservation has durably committed. `booking_status` is `confirmed` or `pending_approval`.                                        | Public submission handler only                                |

Each step counts **once per anonymous consent session and studio day**, across repeated
clicks, navigation, slot changes and request retries. The signed measurement session expires
at browser-session end or 24 hours. Multiple reservations for the same day/session still count
once; the first measured new reservation supplies the completion status. This is not a booking
count, person count or current confirmed-outcome total. Payload remains the outcome authority.
Staff reservations, approval, reschedule and cancellation never add visitor completions.

The provider payload contains only event/UUID, random session identity, a hashed `studio_day_id`,
`schema_version: 1`, fixed privacy controls (`$process_person_profile: false`, `$geoip_disable: true`,
`$ip: null`) and completion's bounded `booking_status`. No contact/booking/submission identifier,
slot ID, session date/time, location, title, price, form content, URL, referrer, campaign tag or
click ID is sent. The collector receives only the event and numeric public day ID for validation.

Consent remains separate from campaign storage. After opt-in, only current visible exposure and
new actions are observed. A previously selected slot is not backfilled; an old saved reservation
retried after consent changes cannot emit. Submission waits for the bounded optional browser
queue, preserving observed order, then uses the current explicit permission flag. Withdrawal
immediately pauses collection and aborts pending browser requests, even if saving the preference
fails. A stale privacy read cannot restore an older choice. Events already delivered or server
capture already begun cannot be recalled by a browser abort. Failed withdrawal is visibly labelled
as paused on this page; save the choice successfully before navigating away.

Delivery is best effort with an atomic at-most-once database claim and stable provider UUID.
Concurrent requests cannot double-count. A failed/ambiguous request is not replayed, and optional
capture failure cannot fail the booking. There is no offline queue or post-withdrawal retry.

The existing conversion overview's EU query still reads **bespoke** events only and remains
disabled. Studio counts display “studio reporting is not connected”; no rate or zero is invented.
A future studio query must enforce the same day key and ordered 24-hour steps, show the measured
session/day denominator and missing coverage, and keep pending approval separate from confirmed
outcomes. Consent refusal, blocked/failed capture, missed visibility and mid-journey consent all
leave gaps. Counts must not join sessions to private customer records. Reader integration, exact
EU-project/Query Read approval and secure activation remain separate dependencies.
