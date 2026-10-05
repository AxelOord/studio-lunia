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
Use a distinct feature branch stacked on PR #38 if that dependency remains unmerged.
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
