# Service landing to enquiry — requirements

Workflow: requirements-first
Status: ready

## Goal and scope

Implement owner-authorized [#33](https://github.com/AxelOord/studio-lunia/issues/33) using the existing page builder and enquiry foundation.
The current issue and its empty comments were re-fetched on 2026-10-05. The later overnight
batch authorization supersedes the issue's earlier instruction to wait for implementation
approval. Keep this batch separate from follow-up automation and studio-day slot booking.

A visitor arriving for a particular service should understand the offer and make a short
request with that service retained. Staff should receive the same private enquiry/customer
history as today. Reuse the existing visual style and blocks. No campaign activation,
Google Ads API, provider credentials, analytics expansion, live email, payments, calendar,
A/B testing, redesign or invented business claims.

## Acceptance criteria

### R-1: Reusable service landing content

Staff SHALL select a published canonical service for a landing page and edit its headline,
body, genuine approved imagery, inclusions and optional price guidance using the existing
page builder. The selected service and CTA SHALL remain consistent across public rendering
and authenticated live preview. Drafts and private media SHALL remain private.
Check: CMS edit/preview/publish, missing or unpublished target, conditional public media,
optional content, existing six block types and pages preserved by additive migration.

### R-2: One clear service-specific enquiry action

A selected service landing SHALL provide a prominent accessible mobile-friendly enquiry
CTA that opens the existing form with the selected service retained. A missing/deleted
service SHALL never silently substitute another service or promise an available booking.
Check: keyboard and desktop/mobile click-through, service identity, invalid targets, no
horizontal overflow or inaccessible action.

### R-3: Short form and recoverable errors

The form SHALL continue to ask only service, name, email and a short message. It SHALL keep
entered details and the same retry identity after validation or temporary submission errors.
Preparation questions and marketing opt-in SHALL not be added to this enquiry flow.
Check: validation, failed save/retry, duplicate submission, successful receipt and reset.

### R-4: Honest next steps

The landing and enquiry journey SHALL explain enquiry → receipt → personal proposal →
booking confirmation. A receipt SHALL explicitly remain an enquiry acknowledgement, and
preview SHALL explain that visitor emails are not sent. Only owner-approved human-response
wording may state a response time; no invented availability or service promise.
Check: landing/form/receipt text and no instant-booking or universal sandbox-delivery claim.

### R-5: Preserve attribution and privacy

Tagged visits SHALL retain the existing consent-aware channel-neutral campaign snapshot
through submission. No consent SHALL still permit an enquiry without optional tracking or
campaign identifiers. No contact fields or message contents SHALL enter analytics.
Check: tagged Google Ads/other channel visit, explicit consent and withdrawal, no-consent
flow, minimized payloads, unchanged analytics allowlist and duplicate-event protections.

### R-6: Preserve operational handoff

A successful enquiry SHALL enter the private enquiry inbox and customer activity with its
original service/message and immutable attribution. The existing proposal/booking workflow
SHALL remain available without introducing follow-up sending or new customer permissions.
Check: public submission followed by authenticated customer workspace and original snapshot.

### R-7: Reviewable delivery

Deliver a focused draft PR, issue/spec traceability, aggregate tests, inspected actual
screenshots, independent review, exact-head CI and an automatic full-CMS preview. A stacked
PR SHALL state its dependency and carry the accepted PR #38/#39 review fixes. No merges or
production deployment. Check preview branch capacity before publishing; do not delete
provider branches or upgrade a plan to make room.
Check: npm run verify, exact commit/preview, user-accessible visual evidence and honest
remaining hosted/content acceptance limits.

## Open questions and safe defaults

The real first service/campaign, approved photos/copy/price guidance and a human-response
promise await owner input. Implement and verify a clearly labelled synthetic preview/local
demonstration with abstract artwork and optional blank commercial claims. Do not invent
prices, testimonials, location, availability or response timing. These content choices
block real campaign launch, not independent implementation. No new provider access needed.
