# Studio visitor instrumentation — design

## Approach and boundaries

R-1: A small client heading wrapper observes current visible exposure once consent/configuration
has loaded. Selecting a currently offered non-full slot records intent, not a hold. The public
reservation route captures only after reserveStudioSlot returns created=true; staff entry,
changes, failed reservations and receipt retries do not capture. Completion includes only the
initial confirmed/pending_approval state. Studio-specific event builders live separately from
the existing bespoke event list and preserve its signatures and payloads.

R-2: Reuse PrivacyControls' serialized, bounded, abortable request chain and signed HttpOnly
consent/session cookies. Expose readiness for current visibility observation, not a replay of
previous interaction. The same-origin collector allowlists client stages and validates a public
published day and current bookable inventory. Server-built payloads hash the day namespace;
only the random consent-session ID and opaque day key identify funnel units. The shared EU
transport retains a persistent at-most-once claim and stable UUID per session/day/stage. No
claim/provider attempt occurs when disabled. Provider errors and claim errors are best effort;
no retry queue can replay after withdrawal. In-flight server capture already begun cannot be
recalled, consistent with the existing consent contract.

R-3: Each step counts at most once for a consenting anonymous session/day, not per person,
selection, booking or submission. Several bookings in one day/session count once. Different days
remain distinct; a later report must constrain the same opaque day key and ordered 24-hour window.
Status is the first measured newly-created booking outcome, never a live confirmed-booking total.
Views include published unavailable days; selection requires offered availability. No identity
join to Payload contacts/bookings. The existing reporting reader/query stays unchanged; its UI
must honestly describe the missing studio aggregate connection.

## Behavior mapping

R-1: Studio payload builder, public collector, heading observer, selection and durable completion.
R-2: Shared transport, privacy queue, created-only server capture and explicit permission gate.
R-3: Documentation, privacy wording, admin missing-coverage label and bespoke regression tests.
R-4: Unit/integration/browser tests, full verify, screenshots and exact-head remote evidence.

## Tradeoffs and verification

At-most-once delivery undercounts ambiguous/lost requests deliberately. Current exposure after
opt-in is observable, but earlier slot selections and saved bookings are not backfilled. Do not
synthesize preceding stages at submit time. The capture cannot prove commercial conversion;
Payload owns bookings/outcomes. Use fake transport injection with real local PostgreSQL claims,
real HTTP collector boundary tests with signed consent cookies, and browser requests with server providers
disabled. Browser tests cover privacy readiness, navigation, retries, withdrawal, available and
unavailable days on desktop/mobile. No provider account or credential is needed.

Privacy-read race reproduction: delay a GET returning analytics consent, save a newer decline,
then release the GET. Without the generation guard the old choice overwrites the new one.
The browser regression preserves declined cookies, an unchecked consent control and no events;
existing bespoke tracking and normal saved-choice hydration remain covered by the aggregate.
