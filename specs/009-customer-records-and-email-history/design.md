# Customer records, activity and email history — design

## Approach and boundaries

Keep Payload/Neon authoritative. Add private Contacts, Bookings, RevenueEntries,
CustomerActivities, EmailTemplates and EmailMessages collections. Operational collections
have no draft/version duplication; templates use an explicit approval state. Keep enquiry
submission snapshots immutable, add explicit contact linkage and backfill one contact per
legacy enquiry. Never infer identity solely from an email address.

Use Payload's pinned transaction API with a shared request, explicit access enforcement,
and database locks/unique command keys for record mutations. Commands carry an idempotency
UUID and content hash: same command returns the prior result, different content conflicts.
Bookkeeping corrections append reversal/replacement facts. Keep booking source and copied
attribution fixed; explicit staff status/value corrections append dated activity.

Native Payload lists/forms provide record navigation and access. Add responsive field/view
components for contact activity/filter shortcuts, enquiry proposal creation, booking commands,
template preview and exact email content/retry. Timeline entries retain occurrence and record
times, source and actor. Known replies are staff-reported notes, not imported email. Draft
messages are prepared snapshots with no scheduled time or background sender.

The renderer accepts a small documented variable vocabulary, rejects missing/unknown values,
escapes text into inert HTML and creates the same subject/text/HTML for preview and snapshot.
New template copy is unapproved synthetic example content. Real-linked draft previews remain
private; sandbox tests render synthetic values and never redirect real customer content.

Refactor the current photographer notification into the shared persisted send path. Retain
its fixed privacy-safe content and editor-only recipient. Freeze all provider request fields
before attempting delivery; reuse that exact payload and key within the existing 23-hour,
three-attempt safety window. Network ambiguity is distinct from provider rejection. Preserve
old notification facts; do not invent an old body/provider ID or resend a changed payload
under an already-used legacy idempotency key.

POST /api/resend/webhook uses a bounded raw body and Svix HMAC verification before parsing.
Verify signature version and timestamp tolerance; reject malformed/forged/expired inputs.
Persist only event identity, email identity, event kind and dates, not arbitrary provider
payloads/addresses. Unique event identity and per-message locks handle concurrent repeats.
Correlate early callbacks through the opaque outgoing message tag before the send response
arrives. Ignore unrelated account events without retaining their payload or addresses.
Derive status from dated facts with terminal safeguards so delayed/sent callbacks cannot
regress delivery or bounce. Preserve every valid fact in the private history.

No analytics changes. New public webhook access, provider registration and signing secret
are gated; no existing credential is read/decrypted. The endpoint remains disabled without
its approved signing configuration. Verify the chosen preview protection permits only the
required webhook ingress before registering it; never broadly disable preview protection.

## Behavior mapping

R-1: additive contact relationship/backfill, stable enquiry IDs and explicit linking.
R-2: staff command UI, proposal/status ledger and fixed source attribution.
R-3: integer money records, append-only correction and transaction/idempotency constraints.
R-4: dated activity view, derived attention/queue filters and honest reply/draft labels.
R-5: one renderer, approved templates, immutable prepared snapshots and explicit sandbox actions.
R-6: one persisted send path, bounded attempts, verified deduplicated delivery facts and status reduction.
R-7: staff-only collections/endpoints, scoped internal capability, safe errors and provider/retention runbook.
R-8: generated migrations/types, complete tests, UI screenshots and exact-head PR/preview evidence.

## Tradeoffs and verification

Prefer a small private operational model over an external CRM or inbox integration. At-most-once
identity and append-only manual money history avoid confusing attempted emails with confirmed outcomes.
No webhook credential is necessary for local signature/order/concurrency tests. Provider-delivered
status cannot be claimed from mocks; owner-approved hosted setup is a separate acceptance gate.
Use synthetic data, preserve existing published content and prior records, and do not claim a
full conversation when inbound messages outside the manual record are unknown.
