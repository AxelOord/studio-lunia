# Enquiries and optional measurement

Related: [#9](https://github.com/AxelOord/studio-lunia/issues/9),
[#11](https://github.com/AxelOord/studio-lunia/issues/11),
[#12](https://github.com/AxelOord/studio-lunia/issues/12).

## Enquiry review

Public service cards supply the choices at `/inquire`. Draft services are excluded.
Required fields are service, name, email and message; no phone, date, location, payment,
booking or customer profile. All preview entries must be synthetic. Contact and message
stay in the private Payload Enquiries collection, accessible only to editors.

Submission creates one record per browser-generated request ID. Retries with identical
content return the same receipt; changed content using the old ID is rejected. No form
content is persisted in browser storage. A lost response can be retried without duplicating
the lead. Origin, body limits, honeypot, validation and database-backed per-email/per-IP
throttling protect the dedicated endpoint; direct Payload REST creation is denied.

Review `new` enquiries in `/admin/collections/enquiries`, contact the person manually when
appropriate, and change follow-up to `contacted` or `closed`. No automated visitor email
is promised. Preview photographer notifications contain only a fixed review instruction,
use the existing editor mailbox and never redirect visitor content to an arbitrary address.
A successful provider response is labelled `accepted`, not delivered; mailbox delivery and later bounces must be checked in Resend. The persistent manual queue remains the source of follow-up work. Local mail for this feature is disabled. Provider rejection/timeouts become `failed`;
interrupted attempts remain visible. The retry button uses an atomic claim and the same
Resend idempotency key, at most three attempts within 23 hours. After that the record is
marked `manual`; do not blindly retry outside Resend's 24-hour idempotency window.

An editor can delete a synthetic enquiry after review. No production retention period is
invented. A live policy, controller/contact details and operational retention decision are
required before real customer use. Enquiries have no version history to duplicate PII.

## Consent and attribution

Separate unchecked choices control measurement and campaign storage. Only the preference
cookie is necessary; it is created when the visitor chooses and expires after 180 days.
No optional cookies, SDK or requests are created by default. Campaign storage lasts at
most 30 days from the first stored touch; repeated visits do not renew that deadline.
Measurement's anonymous ID lasts the browser session, at most 24 hours. Cookies are
signed, HttpOnly, SameSite=Lax, and Secure on HTTPS; malformed/forged/expired values fail
closed. Unavailable optional storage never prevents sending an enquiry.

Accepted identifier-only keys: `utm_source`, `utm_medium`, `utm_campaign`, `utm_id`,
`utm_content`, `gclid`, `gbraid`, `wbraid`. Free-text `utm_term`, arbitrary queries, raw
referrers and full URLs are never retained. Google click IDs identify Google as the first
supported advertising source without a Google Ads API or conversion-feedback integration.
Other channels use the same tagged model. Direct means no observed referrer, untagged
means observed external navigation without accepted tags, unknown means insufficient or
invalid evidence, withheld means campaign consent absent/declined. These are observations,
not perfect attribution claims. First touch is retained; last tagged touch updates; internal
or untagged navigation cannot erase a campaign. Duplicate URL parameters use their first
value, which still must pass validation.

The enquiry stores a versioned immutable consent/first/last snapshot. Future booking and
revenue records must reference the lead and carry that snapshot; this batch creates neither
record type. Browser state must not be re-read to assign historical outcomes. Withdrawal
clears optional cookies and stops future collection; it does not rewrite a submitted lead or
recall events already delivered. Earlier anonymous events cannot be linked to contact details.
No optional offline event queue survives withdrawal.

## PostHog approval and secure handoff

No account, project, management key or paid plan was created for this change. Activation
is blocked pending Axel's approval of the exact PostHog EU account/project, service terms
and DPA, access rights, retention, IP-discard settings and applicable data-use/model-training
choices. Retain the free plan; no payment method/upgrade is authorized. A technical consent
control alone is not a legal determination.

After approval, the owner configures `POSTHOG_PROJECT_TOKEN` and
`LUNIA_POSTHOG_ENABLED=true` in the existing studio-lunia **Preview** provider UI only.
Never paste tokens into chat, PRs, commits, logs or local env exports. No personal API or
management key is needed. The host is fixed in code to `https://eu.i.posthog.com/i/v0/e/`.
Require project IP capture disabled and approve retention before activating. Replay remains
off because there is no recording SDK. Configure no autocapture, person profiles, surveys,
experiments or error tracking for this implementation.

Create an ordered funnel `service_viewed` → `inquiry_started` → `inquiry_submitted`, count
unique anonymous sessions over a maximum 24-hour conversion window and hold `service_id`
constant. Repeated steps for the same service/session are deduplicated in PostgreSQL.
Completion originates only after a lead commit. Missing consent, blocked requests and
provider failure can undercount. Delivery is at-most-once: failures are dropped rather than
queued across withdrawal, and no success claim is made from a local capture mock.

Capture sends only random session ID, opaque hashed service ID, fixed event/schema fields,
a deterministic event UUID and explicit `$process_person_profile=false`, `$geoip_disable=true`,
`$ip=null`. Visitor headers, IP, contact, messages, campaign tags and URLs never enter the
provider payload. Server mediation still means the hosting provider processes HTTP requests.

## Hosted acceptance still required before activation

Verify the automatic preview's exact SHA, full CMS login and native migrations. Using only
synthetic data, verify form → one lead → visible follow-up, editor notification/retry, consent
choices, no-consent/withdrawal, and the three events in the approved EU project. Inspect the
actual ingested properties, no profiles and no replay. Remove synthetic leads and analytics
test data under the approved retention policy. Do not describe hosted analytics as working
until that provider-side check passes. User owns merge and production decisions.

## Official sources checked 2026-10-05

PostHog public docs source pinned at `89b603752551ec71ad914e76e51bfa952af1e098`:
[capture API](https://github.com/PostHog/posthog.com/blob/89b603752551ec71ad914e76e51bfa952af1e098/contents/docs/api/capture.mdx),
[data collection controls](https://github.com/PostHog/posthog.com/blob/89b603752551ec71ad914e76e51bfa952af1e098/contents/docs/privacy/data-collection.mdx),
[ingestion](https://github.com/PostHog/posthog.com/blob/89b603752551ec71ad914e76e51bfa952af1e098/contents/docs/how-posthog-works/ingestion-pipeline.mdx).
HTTP API chosen instead of an SDK to avoid automatic metadata and external scripts;
there is no unpinned SDK dependency. Approval references: [terms](https://posthog.com/terms),
[privacy](https://posthog.com/privacy), [pricing](https://posthog.com/pricing).
Resend [idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys) uses a
24-hour window; this implementation deliberately stops retries sooner.
