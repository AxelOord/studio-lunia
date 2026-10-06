# Experiment groundwork — design

## Approach and boundaries

One private Payload Experiments collection configures two plain-text CTA variants on an exact
published service landing. Native page content remains the fallback. A separate consent flag
and signed 30-day browser cookie gate all experiment operations. Server assignment uses a
stable hash bucket; PostgreSQL participant locks, unique enrollment keys and immutable plans
serialize repeated assignment, revocation and event updates. No analytics provider is needed.

Live mode additionally requires LUNIA_EXPERIMENTS_ENABLED=true (absent/false by default).
Private staff can select a simulation through a signed cookie, then exercise the same public
landing, consent, exposure and durable enquiry pathway. Every request rechecks staff auth for
simulation. Simulation records never enter live experiments. No synthetic outcome button.

R-1: Native private authoring, frozen plan validation and database uniqueness protect lifecycle.
R-2: Dedicated consent, nonrenewing signed cookie, revocation tombstones and browser cancellation.
R-3: Visible CTA acknowledgement and newly committed enquiry hook update one enrollment row.
R-4: Private results with Wilson intervals descriptive only, minimum plan checks and stopped
variant copy into a page draft. No winner, p-value or stopping decision is automated.
R-5: Owned databases, production browser build, screenshots, full verification and draft checkpoint.

## Tradeoffs and verification

Restrict the first test surface to CTA copy and primary outcome to saved enquiries. Arbitrary
blocks, multivariate tests, booking/revenue joins and PostHog experiment APIs are deferred.
Counts describe consenting browser identifiers, not people; cleared cookies/regrant can count
again. Best-effort events can be lost; no outbox backfills after withdrawal. Exposure requires
client visibility acknowledgement, so blocking and fast navigation can miss measurements.
Intervals assume independent Bernoulli samples and are descriptive, not a valid hypothesis test;
repeat browser identities, bias, peeking, attribution loss and sample imbalance need human review.
