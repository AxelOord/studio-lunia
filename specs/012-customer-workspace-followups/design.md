# Customer workspace and safe follow-up planning — design

## Existing flow and chosen UI

The current /admin dashboard lists collection tiles. Enquiries, contact history,
booking actions and exact email previews live on separate native collection forms.
The mobile contact timeline appears below editable contact fields. Staff must infer
relationships and repeatedly leave context; template fetch failures also resemble an
empty template list. These observations come from code and the existing desktop/mobile
browser screenshots, not customer research. See flow-map.md for source references.

Use Payload's pinned admin views and DefaultTemplate so authentication, navigation,
account controls and access remain native. Replace the dashboard with an enquiries
inbox; add /admin/customers/:id and /admin/follow-ups. Keep native records available as
secondary details. A server wrapper uses initPageResult.req/user with explicit access;
small client components handle typed, authenticated HTTP actions and shared rendering.

The inbox shows a restrained header, filter counts, search and rows/cards containing
customer, requested service, state, last activity and one useful next action. Search is
POSTed; only safe filter/page values enter URLs. The workspace header keeps the customer
and selected enquiry visible. The main column contains the request and dated conversation;
a side column contains the booking and next follow-up. On mobile these stack in the same
order. Prepare reply/proposal and plan-follow-up forms open in context with Save/Cancel,
field errors and an exact email preview. Return paths retain safe filter/context state.
Do not expose raw JSON, minor currency units or provider internals in the primary journey.

Reuse record commands, frozen email rendering, EmailFrame and idempotent action behavior.
Separate failed template loading from an empty list. Keep booking/value semantics and
manual revenue history intact. A private draft is saved explicitly; previewing does not
save or send. New guided views cover the main journey without rewriting every collection.

## Follow-up state and data

Add a private FollowUps collection with contact, enquiry/booking, purpose, trigger identity,
revision, planned UTC instant, IANA timezone, template/content snapshot, exact preview,
state, blocking reason, job reference, attempt/result facts and actor timestamps. Pending
edits increment revision and append activity. Never alter an existing EmailMessage body.
At handoff, persist/reuse an immutable message/attempt identity; simulated results use
an explicit simulation outcome, never accepted/delivered. Job inputs contain only IDs
and revision, without recipient, body, arbitrary URLs or full inbound events.

Use a small explicit transition table: draft/planned/blocked/paused/cancelled/processing/
simulated/failed/manual-review. A terminal attempt cannot be silently changed or resent.
Pause/cancel/reschedule invalidate the old revision and its queued job. An obsolete job
returns without overwriting the current plan. Use existing command idempotency and a
unique trigger key containing source event, purpose and rule revision. No default rule
creates active plans; approving a rule for test planning never enables live sending.

Use bounded explicit planning rules for enquiry follow-up, preparation and session
reminder. Store offsets, timezone and any working-day calendar explicitly; require these
choices before applying business-day arithmetic. Suggestions from #25 are labelled,
inactive examples. Show the resolved local time, offset and UTC instant before Save;
reject impossible local times and require disambiguation rather than silently moving a
DST time. A session change replaces only future eligible revisions. Late/overlapping
reminders are skipped or combined through an explicit rule, never sent in a catch-up burst.

Eligibility is purpose-aware and conservative. No-response plans require a trustworthy
reply route and an explicit source message/proposal event. A recorded later reply, new
booking, closed/refused enquiry, relevant opt-out/pause, changed contact linkage, or
failed/bounced/delayed/uncertain delivery blocks affected plans. Confirmed-session plans
must still refer to the current session; replies can pause them for staff review.
Manual known replies also stop plans, with their provenance retained. Native edits and
commands must run the same invalidation hooks, so raw collection access cannot bypass it.

## Jobs, races and incoming adapter

Configure one pinned Payload task with queue/waitUntil and ID/revision input. Disable
REST queue/run/cancel access and automatic in-process cron. The server's staff-only,
same-origin test action invokes a bounded batch using an explicit trusted capability.
Production/local UI execution uses a simulation transport only; it cannot call Resend
or promote a customer draft to real delivery. Fault-injected transports are test-only.

For each attempt, acquire the shared conversation/plan locks in a consistent order,
re-read source/stop/revision state and freeze the decision immediately before handoff.
Mutations that record a reply, booking, refusal, opt-out or cancellation participate in
the same ordering. Persist outcome identity transactionally; bounded lease/retry recovery
reuses it. A stop committed first wins; a completed/uncertain handoff cannot truthfully
be called cancelled. Verify both race orders with barriers and actual PostgreSQL, not
sleep-based assertions. Extending this boundary to real network delivery remains gated
until provider idempotency windows and the activated runner are verified together.

Implement a disabled receiving adapter using bounded raw-event signature verification,
allowlisted event types and an approved dedicated-route contract. Match an opaque reply
route/reference to one conversation; never merge solely by sender address or subject.
Unknown/conflicting approved-route events enter a private review queue. Keep only needed
identity/timestamps/provenance and bounded plain text; no attachment downloads or remote
HTML rendering. A separately approved retrieval capability would be needed for provider
message content; do not reuse/expand the current send-only sandbox credentials. All
local matching, replay and stopping tests use synthetic events/injected content retrieval.

## Current provider constraints and implementation gates

Pinned Payload 4.0.0-canary.37 types expose queue waitUntil, task retries, leases and job
access rules, and warn against jobs.autoRun on Vercel. Inspected installed source/types
remain authoritative; the v4 jobs documentation URL was unavailable to this executor.
Vercel currently documents Hobby cron as once daily with hour-level precision. No cron
route, external scheduler, provider registration or paid plan is activated in this batch.
The admin reports automatic dispatch unavailable and lets staff run explicit simulations.
Resend receiving needs an approved receiving domain/address and webhook/content-access
configuration. Their existence/permissions are not inferred from sending access.

Sources inspected 2026-10-05: [Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing),
[Resend receiving](https://resend.com/docs/dashboard/receiving/introduction), and installed
payload/dist/queues/config/types, queues/localAPI and admin/views types. No legal or
production-readiness conclusion follows from the local implementation.

## Behavior mapping and verification

R-1, R-2, R-3: guided views, bounded inbox/workspace reads, explicit actions and browser journeys.
R-4, R-5: private plans, revision/trigger keys, planning rules and shared stop hooks.
R-6: disabled narrow inbound adapter, provenance/review queue and synthetic signature tests.
R-7, R-8: persistent Payload tasks, transactional eligibility, simulation-only transport,
explicit capability gates, race/recovery tests and an activation runbook.
R-9, R-10: additive migrations, shared access/validation, preserved history, #37's isolated
fixtures and full npm run verify, followed by screenshots, independent review, exact CI
and automatic preview. Small feasibility tests precede final schema/UI implementation.
