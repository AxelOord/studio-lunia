# Customer records, activity and email history — requirements

Workflow: requirements-first
Status: ready

## Goal and scope

The photographer needs private linked records, an honest activity history and editable
email previews in Payload. Axel selected #10, #23 and #24 on 2026-10-05. Current issue
bodies and all comments were read first (zero comments on these tickets). This selected
shared-record slice supersedes the older general "no CRM expansion" boundary only here.

Exclude scheduled follow-ups #25, studio pages #26, slot/capacity booking #27, funnel
overview #28, Google Ads feedback, payments processing, calendar sync and mailbox import.
Future studio slots will confirm directly by default with manual approval per day; this
batch implements neither scheduling nor studio-day configuration. Existing enquiry,
attribution, preview isolation and consent-first PostHog behavior remain intact.

## Acceptance criteria

### R-1: Stable private contact and enquiry linkage

New enquiries receive a private contact record; repeated email addresses never silently
merge people. Staff may explicitly link an enquiry to an existing contact. Existing leads
are backfilled without changing submitted content, dates, attribution or notification facts.
Check: migrate existing synthetic leads, submit repeats, link explicitly and verify independent history and unchanged attribution.

### R-2: Staff-led booking records

Staff can create a proposal from an enquiry and explicitly confirm, complete or cancel it.
Expected value/currency and session time are separate from realised revenue. Dated changes
record actor/source/reason; corrections preserve earlier facts. An enquiry or email is never
itself a confirmed booking. The booking keeps the enquiry's immutable attribution snapshot.
Check: proposal/confirmation/cancellation/correction journeys, immutable source snapshot and concurrent repeated creation commands.

### R-3: Manual payment and refund ledger

Staff can record manual payments/refunds and correct an entry through an explicit append-only
reversal/replacement. Amounts use integer minor units and an explicit currency; no provider
charge or refund occurs. Idempotent commands cannot duplicate bookings, ledger entries or
future outcome identities. Cancellation does not fabricate a refund.
Check: partial refund, correction, conflicting duplicate key, concurrent requests, currency/amount validation and expected-versus-realised totals.

### R-4: Readable and honest customer activity

A contact's dated timeline links enquiries, booking changes, outgoing drafts/snapshots,
delivery facts and explicitly staff-recorded known replies. Search/filter views surface new
enquiries, waiting customers, upcoming confirmed sessions and attention items. Draft mail
is labelled unscheduled; unimported replies and historical content gaps remain explicit.
Check: multiple enquiries/bookings per contact, relinking, status changes, manually reported reply provenance, filters and exact message links.

### R-5: Shared email rendering and immutable snapshots

Editable enquiry, booking and follow-up templates have desktop/mobile live preview using
the sending renderer and allowed variables. Preview/edit never sends. Unapproved/incomplete
templates cannot be prepared for sending. A prepared draft preserves rendered subject,
text/HTML, resolved variables and source links; later template/contact edits do not rewrite it.
Explicit sandbox test sends use synthetic values and only the approved editor recipient.
Check: missing/unknown variables, escaping, multiline content, preview/render equivalence, immutable snapshots, no send on edit/preview and recipient enforcement.

### R-6: Truthful shared send and delivery history

Reuse the enquiry notification sender through one persisted send path. Distinguish draft,
queued, sending, provider accepted, delivery delayed, delivered, bounced, failed and uncertain/
manual recovery. Provider IDs and occurrence/receipt times are retained; delivery is not read.
Verified Resend events are deduplicated and applied atomically regardless of order, including
webhooks arriving before the send response. Missing old snapshots are labelled unavailable.
Check: raw-body signatures/timestamps, duplicate and concurrent events, out-of-order facts, early webhook, rejection/timeout, bounded retry and no duplicate provider request bodies.

### R-7: Privacy, access and activation boundaries

Operational records/content stay private to staff and never enter PostHog or public fixtures.
Corrections have dated provenance; no automatic purge or invented live retention policy.
Existing records are preserved. Customer mail stays disabled pending separate wording,
sender/reply/domain/recipient approval. New webhook registration/signing-secret handoff
requires exact owner approval; local signed fixtures do not prove hosted delivery.
Check: anonymous and forged-operation denial, immutable history/snapshot writes, safe errors, no PII analytics changes and documented provider/retention gates.

### R-8: Reviewable delivery

Additive migrations, aggregate tests, responsive accessible admin QA, exact-head CI and
automatic full CMS preview evidence accompany a linked draft PR to verified develop.
Other release/workflow branches remain untouched; user owns merges and issue completion.
Check: check/build/integration/browser suites, desktop/mobile screenshots, generated schema consistency and exact preview SHA.

## Open questions

No blocking implementation question. Safe defaults: separate contacts until explicit linking,
staff-led proposals, manual ledger only, draft examples requiring staff approval, no scheduled
send, synthetic sandbox tests only. Live wording/sender/reply/retention and Resend webhook
registration/access remain activation decisions, documented before requesting that handoff.
