# Studio-day pages and session slots — design

## Model and rendering (R-1, R-2, R-6)

Add versioned StudioDays with existing six page blocks and native publishing/preview, plus explicit
operational fields. Public routes /studio-days and /studio-days/[slug] render only published content;
editor preview requires authentication. A separate public availability endpoint returns only current
slot IDs/times/remaining places, never bookings or contacts. Derived private StudioSlots are immutable
per published schedule revision; old rows stay for committed bookings.

A shared pure time helper reuses the pinned existing IANA/DST candidate logic. Explicit local day,
opening/closing times and optional repeated-time offsets become UTC intervals; duration plus buffer
sets the slot step. Each submitted booking carries the reviewed schedule revision. Closing/cancelling,
expiry, publication and remaining capacity are rechecked transactionally, regardless of browser state.
No reservation is created until final submission; no abandoned-hold expiry worker is necessary.

## Transactions and commitment snapshots (R-3, R-4)

Extend existing Bookings with source=studio_slot, optional enquiry, pending_approval status, slot/day
references, booking revision, unique HMAC submission/content hashes and a private immutable-at-creation
snapshot. Use existing Contacts without automatic email merging. One booking consumes one place.

All booking mutations lock affected studio-day rows in sorted order, then the booking row, rechecking
revision after lock acquisition. A database capacity guard and partial unique seat allocation prevent
active bookings exceeding slot capacity. Availability also excludes overlapping occupied intervals
from older schedule revisions, including each original buffer. Public and staff commands share this
path. The same submission identity returns its one existing booking; conflicting input returns 409.

Publish hooks lock the same day, compare the last published operational configuration and require
explicit acknowledgement when active bookings are affected. They generate a new immutable schedule
revision; existing booking snapshots/statuses remain unchanged. New slot availability accounts for
old commitments. Rescheduling records previous/new snapshots and an explicit staff reason, requires
review of replacement conditions, locks both days, checks capacity and retains the original pending/
confirmed state. Cancellation releases capacity atomically; approval converts pending to confirmed
without acquiring another place. Terminal changes and past-session approval are rejected clearly.

## Customer workspace and messages (R-5)

Studio bookings do not fabricate enquiry records. Make enquiry relationships optional only where
booking context supplies the existing customer/service data. Keep user Local API access checks and
all old enquiry operations. Route studio mutations through their capacity-aware commands; generic
manual booking changes cannot bypass them. A compact studio-day management view exposes availability,
pending decisions, customer records and staff entry/reschedule/cancel controls at desktop/mobile widths.

Freeze private confirmation/pending/change/cancellation message drafts from the saved booking facts.
No provider transport is called. Message preparation runs after the booking commit with durable pending/
failed/ready state and idempotent revision identity, so a rendering failure cannot lose a reservation.
Changes disable obsolete draft messages and cancel obsolete simulation jobs. Approved preparation and
reminder rules reuse #25 only for confirmed sessions, with optional-enquiry booking context. Failures
remain visible and recoverable. Default generated wording reports facts and preview limits only;
it makes no commercial or delivery promise.

## Privacy and boundaries (R-6, R-7)

Reuse bounded JSON, same-origin checks, honeypot/rate limits, consent settlement and minimized campaign
snapshots. Booking responses contain a receipt, status and reviewed service facts, never public contact
records. No new event types or advertising integrations; those belong to #28. Draft pages and all
customer/message records remain private. Dates/prices/conditions are user-configured, not inferred.

Additive migration preserves existing enquiry bookings and records. Tests use owned synthetic local
PostgreSQL databases, real concurrent commands and actual browser flows. Inspect before delivery.
Exact-head GitHub CI remains required. Automatic preview is expected to be quota-blocked at Neon10/10;
record the actual result without retrying or changing provider resources.

## Implementation and review notes

The custom booking/availability endpoint is `/api/studio-sessions`, keeping Payload's native
`/api/studio-days` content API intact. Capacity is enforced by a PostgreSQL trigger under the studio-day
row lock plus a partial unique active-seat index. Availability counts overlapping active commitments
across all schedule revisions in one query. Changes take the conversation lock before cancelling
obsolete jobs, serializing against in-flight simulations. Last published settings, rather than draft
settings, determine current slot revision and capacity.

Form submissions can only restrict server consent further. This withholds optional attribution while
withdrawal is in flight or failed even if the browser still carries the previous signed consent cookie.
The shared campaign validator returns only its allowed top-level snapshot fields. No new analytics
events were added. Approved reminder rule/template reads accept the existing trusted server capability;
visitor access remains denied.

The ticket's [Google Ads landing-page guidance](https://support.google.com/google-ads/answer/6238826)
was checked on 2026-10-06. The editable offer, prominent session action and mobile layout follow its
ad/landing consistency and clear navigation guidance. This is a design reference, not Ads activation.
Real photographs and commercial wording remain owner inputs; synthetic bootstrap is explicitly labelled.
