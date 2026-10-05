# Inquiry, attribution and consent — requirements

Workflow: requirements-first
Status: ready

## Goal and scope

Authorized batch: [#9](https://github.com/AxelOord/studio-lunia/issues/9),
[#11](https://github.com/AxelOord/studio-lunia/issues/11),
[#12](https://github.com/AxelOord/studio-lunia/issues/12). Bodies and all comments
fetched 2026-10-05; no comments. User authorized specs/build/test without another
spec approval. Base develop: 4fed010. No booking/calendar/payments, platform feedback,
A/B testing, production deployment, account/credential creation or workflow changes.

### R-1: Accessible service enquiry (#9)

WHEN a visitor selects a published service, the system SHALL accept name, email and
message with clear validation, retry without lost input, pending and confirmation states.
Check: desktop/mobile keyboard journeys, invalid/missing fields, server/network failure.

### R-2: Durable, private, deduplicated operations (#9)

WHEN a valid enquiry is submitted, the system SHALL persist exactly one private Payload
lead per idempotency key, reject spam and conflicting reuse, and expose a manual
photographer follow-up queue. Confirmation is on-screen; preview sends no visitor email.
An editor-only notification contains no contact/message data; failed delivery remains
visible and retryable, bounded to the provider idempotency window.
Check: concurrent/repeated POSTs, mismatched reuse, honeypot, size/origin/rate limits,
public access denial, failed notification/retry and follow-up status edits.

### R-3: Consent-aware attribution (#11)

WHEN campaign storage is explicitly allowed, the system SHALL retain validated channel-neutral
first and last campaign touches for 30 days, including Google click identifiers, with the
lead. Absent, direct, untagged, invalid/unknown and withheld traffic remain distinguishable.
The immutable snapshot and lead ID form the handoff to future booking/revenue records;
creating those records is outside this batch. No raw URL/referrer or arbitrary parameters.
Check: supported parameter matrix, Google/non-Google, malformed/tampered/expired storage,
declined and withdrawn consent, cross-page and repeat visits.

### R-4: Explicit consent and withdrawal (#11, #12)

WHEN consent is unknown/declined/withdrawn, the system SHALL emit no analytics events and
retain no campaign identifiers. Separate unchecked choices control measurement and campaign
storage. Withdrawal clears first-party optional storage and stops future collection;
prior submitted operational records are not silently rewritten. Necessary preference storage
lasts 180 days. Enquiries work without optional consent.
Check: no-consent network/storage assertions, independent choices, reload, withdrawal,
blocked storage and stale/in-flight UI handling.

### R-5: Minimal EU funnel (#12)

WHEN measurement is allowed and an approved EU project is configured, the system SHALL send
service_viewed, inquiry_started and inquiry_submitted without duplicate events. Only opaque
service/session/event identifiers and fixed schema metadata leave the app. No contact data,
messages, raw URLs, campaign strings, IP forwarding, person profiles or replay.
Check: intercepted exact outgoing payloads and endpoint; repeated events and successful-submit
proof; provider failures never fail an enquiry; unconfigured analytics sends nothing.

### R-6: Review evidence and activation boundary (#9, #11, #12)

WHEN proposing the batch, the system SHALL provide migration, aggregate tests, browser
screenshots, exact-head CI and an automatic full CMS preview on studio-lunia, with provider
blockers explicit. Draft PR targets verified develop with real issue links; user owns merges.
Check: recorded commands, screenshot inspection, PR related links, deployment SHA and CMS routes.

## Open questions

PostHog activation requires Axel to approve an exact EU project/account, service terms/DPA,
retention and access, then securely configure the project token and activation flag in Preview.
No credential is requested in chat. No paid plan or production activation is authorized.
Safe implementation defaults are ready for review; legal adequacy is not claimed.
