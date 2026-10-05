# Service landing to enquiry — design

## Existing system and boundaries

Pinned Payload 4.0.0-canary.37, Next 16 and Node 24 remain unchanged. Pages use six native
blocks. A Services item is the canonical service, identified by page ID and stable item ID.
`publishedServices` currently supplies the public form choices and validates submissions.
`ServiceInquiryLink` already carries the service ID and calls the existing consent-aware
service events. Reuse these boundaries instead of introducing a second service collection.

## Content and rendering (R-1, R-2, R-4)

Add optional landing-page service selection to Page Settings, with a friendly native CMS
selector of published services. Extend existing Services items with optional plain-text
inclusions and price guidance. Bound all inputs, preserve existing defaults and avoid a new
page block type. The additive migration preserves all current pages, drafts and versions.

Resolve the selected service on the server against published canonical choices. Public
rendering and authenticated live-preview population share that resolution. Never accept
service titles, prices, contact details or arbitrary query values as the source of truth.
A missing target suppresses the actionable service CTA and explains unavailability without
substituting a different service. Publishing validates a configured target; incomplete
drafts may remain editable.

Use the existing hero/CTA visual treatment for a primary enquiry action and selected-service
context. Existing gallery/image-text blocks continue to supply approved images. Add a small
reusable next-steps presentation explaining enquiry, receipt, personal proposal and eventual
booking confirmation. Optional response wording is editor-owned, with no default deadline.
The selected service's title, inclusions and price guidance remain visible near the form.

## Form, consent and handoff (R-3, R-5, R-6)

Keep the current short form, validation, honeypot, stable UUID submission identity and
submission transaction. Preserve consent settlement before posting and existing campaign
snapshot minimization. Do not add events or form-content analytics. Reuse the existing
receipt and preview sending boundary, clarifying that receipt is not a confirmed booking.
The normal enquiry/contact/activity creation remains the operational handoff.

## Demonstration and verification (R-7)

Create an idempotent synthetic landing demonstration for local and automatic preview
initialization, without overwriting existing content or changing home/media fixtures.
Clearly identify test content; no invented commercial claims or real customer sends.
Use a distinct feature branch stacked on PR #39 (which depends on PR #38) if that dependency remains unmerged.
Tests own their fixtures and local database, including a complete tagged/no-consent visit
through enquiry and staff handoff. Inspect actual desktop/mobile screenshots. Report owner
content inputs and authenticated hosted QA separately from implementation and CI.

## Referenced guidance

Reviewed the issue's sources on 2026-10-05. Google's landing-page guidance supports matching
service content and CTA to the originating ad, putting useful information near the top and
keeping mobile navigation simple. This design retains a canonical service across landing
and enquiry rather than activating ad experiments. [Google Ads Help](https://support.google.com/google-ads/answer/6238826).

NN/g recommends removing questions that can wait, keeping labels close to controls and
using a simple vertical form. The existing name/email/message enquiry remains short;
preparation questions belong later. [NN/g form-design guidance](https://www.nngroup.com/articles/web-form-design/).

## Implementation decisions and evidence

The native Page Settings selector stores only the stable service ID. Public rendering,
saved preview and live-preview population all resolve offer details from published
service cards; a forged client-side offer is overwritten by server resolution. Draft
service edits cannot replace an already published offer. Publishing rejects an unavailable
selected service, including removing a selected service from the same page.

An optional landing action follows the first hero's copy; pages without a first hero
show the same service summary/action before their blocks. The existing six block types
and media access remain intact. The form shows the canonical offer for the current
selection and explicitly requires a new choice when a requested service is unavailable.

The `/service-demo` initializer owns a transaction and changes nothing when that page
already exists. It uses a generated canonical item ID, synthetic copy, abstract artwork
and blank prices, inclusions and response promises. Injected initialization failure
rolls back the new page; retry completes it once. Preview's existing home, media and
editor fixtures remain unchanged.

Focused checks: five service integrations, additive migration preservation, two native
preview-bootstrap integrations and three Chromium journeys. Browser cases cover
no-consent tagged landing → lost-response retry → one private enquiry/customer activity;
consented minimized campaign attribution → explicit withdrawal; and native selector →
unsaved live preview → publication → missing service. Actual desktop and 390px screenshots
were opened and inspected. The primary CTA precedes the mobile artwork; form errors retain
all details and focus the error summary. Optional tracking/provider settings are unchanged.

Delivery depends on PR #39 and PR #38, with the corrected queue navigation included.
Actual Neon branch capacity cannot be read using the exposed tools; the parent reported
that PR #39 likely consumed the final slot. Keep this branch local until capacity is
confirmed. Do not delete data, change preview settings, create credentials or upgrade plans.
