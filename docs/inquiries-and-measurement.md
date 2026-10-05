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
A successful provider response is labelled `accepted`, not delivered; mailbox delivery and later bounces must be checked in Resend. The persistent manual queue remains the source of follow-up work. Local mail for this feature is disabled. Provider rejection becomes `failed`; timeouts are `uncertain` in the exact email history and appear as `failed` in this legacy enquiry summary;
interrupted attempts remain visible. The retry button uses an atomic claim and the same
Resend idempotency key, at most three attempts within 23 hours of the first attempt. After that the record is
marked `manual`; do not blindly retry outside Resend's 24-hour idempotency window.

The visitor sees **Thank you. Your enquiry is saved.**, the saved record's reference,
manual follow-up wording, and **Preview: no email confirmation is sent to visitors.**
The photographer notification uses `MAIL_FROM` as sender and only `PREVIEW_EDITOR_EMAIL`
as recipient. Its subject is **Studio Lunia preview: enquiry to review** and its complete
plain-text body is:

> A synthetic preview enquiry is ready in Payload. Open the Enquiries collection in your Studio Lunia preview, review the record and update its follow-up status. No visitor email has been sent.

It contains no name, email, message, service, attribution, lead reference or attachment;
the editor opens the private CMS queue to review the record. This notification path runs
only with `LUNIA_CMS_PREVIEW=true`. Missing provider configuration or rejection is `failed`; an eight-second timeout is `uncertain`
in the email history. These failures never undo the lead. See [the shared sender runbook](customer-records-and-email.md).

Operational enquiry deletion is now blocked to preserve linked booking/email history. Synthetic test cleanup uses the local-only test database role. No production retention period is
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

### Concrete approval proposal (not activated)

- Approve a dedicated **Studio Lunia Preview** project in an owner-controlled PostHog
  EU (Frankfurt) account/organization. Use the free plan without a card, add-on or upgrade.
  The current free plan allows one project; do not replace an existing project or alter
  another organization's membership to make room without a separate decision.
- Keep Axel as the only human with access initially. The application needs only the
  ingestion project token; it needs no personal API key, management scope, billing role
  or invitation. Axel can inspect events and create the funnel in the UI. If a named
  collaborator is later approved, organization Member is sufficient for analysis;
  the free plan does **not** provide project/resource isolation and members can edit
  all resources. Do not promise a restricted viewer role on this plan or grant Admin.
- Turn **Discard client IP data** on, disable GeoIP enrichment, and opt out of data use
  for provider model training before the first event. Leave replay, autocapture, person
  profiles, surveys, experiments and error tracking off. Confirm these in the actual UI;
  no settings change has been made by this task.
- Approve the current terms and DPA before signup/use. The terms' model-training opt-out
  applies prospectively, so select it before capture rather than after testing.
- Proposed preview data policy: synthetic events only, disable capture at the end of
  acceptance, and have the owner delete the dedicated test project after acceptance,
  with a target within 30 days of the first test. This is an operational proposal, not
  an automated retention job or a claim about the provider's deletion completion time.
  Record confirmation when that deletion actually completes.
- PostHog's documented free event retention is **one year**. It is not a deletion
  guarantee, cannot be shortened through a setting, and a shorter period is not offered
  on request. There is no implemented 30-day provider TTL. Continued use requires explicit
  approval of those actual terms and a deletion policy; otherwise leave capture disabled.
  Live enquiry/contact retention is a separate decision and remains unset.

The exact JSON shape sent by this implementation is below; placeholders are descriptions,
not values to paste into provider settings. `event` is exactly one of `service_viewed`,
`inquiry_started`, `inquiry_submitted`.

```json
{
  "api_key": "<project ingestion token from Preview environment>",
  "uuid": "<deterministic UUID for session + service + event>",
  "event": "service_viewed",
  "distinct_id": "<random browser-session UUID, maximum 24 hours>",
  "properties": {
    "service_id": "<first 24 hex characters of SHA-256 of service ID>",
    "schema_version": 1,
    "$process_person_profile": false,
    "$geoip_disable": true,
    "$ip": null
  }
}
```

No client timestamp is sent; provider ingestion supplies event time. The ordered funnel
uses unique `distinct_id` values (each represents a session here), a 24-hour window, and
constant `service_id`. A submission event is eligible only on the successful new-record
commit with measurement consent at that time. Retrying a saved enquiry never backfills
a conversion after later consent or starts another completion in a new session.

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
[Event retention](https://github.com/PostHog/posthog.com/blob/89b603752551ec71ad914e76e51bfa952af1e098/contents/docs/data/events-retention.mdx),
[storage/deletion controls](https://github.com/PostHog/posthog.com/blob/89b603752551ec71ad914e76e51bfa952af1e098/contents/docs/privacy/data-storage.mdx),
and [access control / free-plan limits](https://github.com/PostHog/posthog.com/blob/89b603752551ec71ad914e76e51bfa952af1e098/contents/docs/settings/access-control.mdx)
were also checked for the concrete approval proposal.
HTTP API chosen instead of an SDK to avoid automatic metadata and external scripts;
there is no unpinned SDK dependency. Approval references: [terms](https://posthog.com/terms),
[privacy](https://posthog.com/privacy), [pricing](https://posthog.com/pricing).
Resend [idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys) uses a
24-hour window; this implementation deliberately stops retries sooner.
