# Architecture and scope

One Next.js app serves public pages and Payload admin/REST. PostgreSQL stores content;
local `media/` is development-only. Explicit migrations are committed; automatic schema
push is disabled. Test data is synthetic. No real photographer claims are seeded.
All editors currently share full CMS rights; no public user registration is permitted.
Content reads enforce publication and media visibility. Draft preview requires a valid
editor session on entry and on every page request. Dynamic rendering avoids stale
published content and draft cache leaks; caching can be added with targeted invalidation later.

Typed hero, text and gallery blocks are reused alongside image/text, service cards and
internal CTA blocks. Styling is provisional; real brand assets and copy are still pending. Image upload
requires alt text and supports raster derivatives. The foundation stays noindex, including
robots.txt; publication SEO/sitemap requires real domain/content approval later.

## Measurement roadmap

Google Ads is the first complete future platform adapter. Generic tagged traffic from
Meta/Instagram/email uses the same attribution model. No other platform feedback/spend
integration is claimed. The enquiry batch adds private leads, consent-first campaign cookies and an opt-in EU
measurement collector. Advertising feedback remains absent. See
[the batch design](../specs/008-inquiry-attribution-funnel/design.md).

Future: permitted campaign/click IDs + consent snapshot → lead ID → qualified/confirmed/
cancelled/revenue events → deduplicated delivery outbox → platform adapter. Keep contact
information outside general analytics. Never retain arbitrary URL query strings. Unknown
attribution is a real reporting bucket. A consent grant is only a technical prerequisite,
not a legal determination; server-side delivery has no universal consent exemption.

Report spend, CPL, cost per confirmed shoot and value/ROAS with explicit attribution
windows, currency and expected versus realized value. Reconcile internal outcomes and
platform counts without promising perfect attribution. Start experiments only after
baseline QA and sample-size planning; low traffic may mean inconclusive results.

## Small specs after foundation

1. `002-hosted-cms-preview`: protected hosted editor login, durable database/media,
   password recovery, isolated preview secrets and proven backup/restore; see its spec.
2. `003-reusable-page-blocks`: editor-configurable editorial sections with provisional
   styling, additive migrations and local desktop/mobile CMS/browser verification.
3. `004-automatic-pr-previews`: credential-free read-only sample pages for automatic
   trusted branch reviews; hosted CMS stays isolated.
4. `005-full-cms-pr-previews`: native database branches, automatic migrations, synthetic
   CMS bootstrap and shared preview services; supersedes showcase as the default.
5. `006-upload-size-feedback`: accurate empty-upload feedback and real file-picker
   metadata regression for private storage.
6. `007-page-management`: native Content/Page settings tabs, useful block/media labels,
   authenticated unsaved split preview and explicit draft/publish controls.
7. `008-publish-to-attributed-inquiry`: real portfolio/service content, request form,
   permitted campaign attribution, spam controls and private admin review.
8. `009-booking-outcomes-and-ad-feedback`: confirmed outcomes/value, Google Ads adapter,
   deduplication, retries, cancellation adjustments and consent eligibility.
9. `010-campaign-performance`: spend ingestion and reconciled campaign reporting.
10. `011-controlled-experiment`: one hypothesis, stable consent-aware assignment,
    exposure events and statistical stopping rules.

Booking model (request versus confirmed slots), brand/assets, jurisdiction/consent,
and notification route remain decisions. Preview services are configured; outstanding
hosted acceptance is tracked in the preview runbook. No CRM expansion.

## Selected private records slice (#10, #23, #24)

The owner-selected batch supersedes the general no-CRM boundary for private Contacts,
Bookings, RevenueEntries, CustomerActivities, EmailTemplates and EmailMessages only.
Bookings are staff records, with separate expected value and manual realised money history.
There is no calendar, payment provider, mailbox sync, scheduled follow-up or Ads feedback.
See [the active design](../specs/009-customer-records-and-email-history/design.md) and
[activation limits](customer-records-and-email.md).
