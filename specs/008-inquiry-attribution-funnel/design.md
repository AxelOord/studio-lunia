# Inquiry, attribution and consent — design

## Approach and boundaries

Use published Payload service-card item IDs as the catalogue; do not invent services.
Add /inquire and private enquiries collection, with immutable input/attribution and editable
follow-up status. Dedicated bounded same-origin routes validate input before a Local API
create with overrideAccess: false and a server-only capability context. Standard REST cannot
forge that context. Unique submission hash plus content digest handles duplicate retries;
only a non-PII receipt is returned. PostgreSQL guards rate limits across instances.

Notification state lives with the lead. Automatic attempt after commit and editor retry
use atomic claims, fixed Resend idempotency keys and a 23-hour retry cutoff; older ambiguous
failures require manual follow-up to avoid duplicate provider delivery. Preview recipient is
only PREVIEW_EDITOR_EMAIL. Local notification is disabled and clearly labelled. No visitor
email is promised; on-screen receipt explains photographer follow-up and preview limitations.

Consent preference and attribution use signed, HttpOnly, SameSite=Lax first-party cookies,
Secure on HTTPS. Storage parsers reject oversized, malformed, expired and forged values.
Campaign keys: utm_source, utm_medium, utm_campaign, utm_id, utm_content, gclid, gbraid,
wbraid. Free-text utm_term is deliberately omitted. Conservative identifier syntax rejects
email, URLs and phone-like values. Only submitted leads retain snapshots; future outcomes
reference the lead and copy that snapshot without re-reading browser state.

Use PostHog capture HTTP API through a same-origin server collector instead of loading a
browser SDK with automatic metadata. Fixed https://eu.i.posthog.com/i/v0/e/ endpoint;
$process_person_profile=false and $geoip_disable=true. No SDK, autocapture, replay,
feature flags, surveys, browser exception capture or outbound URL/referrer metadata.
Signed consent contains an anonymous session identity only after measurement opt-in.
Database event claims deduplicate session/service/step; submission comes only after durable
lead creation. No catch-up of pre-consent views/actions. Withdrawal deletes optional cookie
state and suppresses subsequent events; already delivered events require provider deletion
outside the visitor preference control. No offline analytics queue survives withdrawal.

## Behavior mapping

R-1: semantic labels, focusable error summary, native constraints, retained form state and explicit receipt.
R-2: bounded route, private collection, unique key, digest comparison, durable notification and follow-up states.
R-3: signed first/last snapshot with whitelist and expiry, attached server-side at submission.
R-4: independent consent controls, deny by default, signed cookies and explicit withdrawal semantics.
R-5: allowlisted server-built EU API payload, persistent duplicate claim and no browser tracker.
R-6: additive migration, local database/browser checks, exact-head CI and native preview evidence.

## Tradeoffs and verification

Consent-first minimizes coverage; blocked requests and declined consent make funnels incomplete.
No identity joining across consent sessions or contact data. Server capture hides visitor IP
from PostHog but hosting still processes requests normally. Campaign strings are operational
only, never analytics properties. Browser-declared direct/referral status is an observation,
not proof of marketing origin. Anonymous measurement can still be personal data; approval
and policy review precede activation. See review.md for pinned official source and evidence.
