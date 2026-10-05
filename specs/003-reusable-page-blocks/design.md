# Design

## Approach and boundaries

Reuse hero, text and gallery rather than clone them. Add imageText (heading/body/image,
image side), services (heading and 1–6 title/body cards), and callToAction (heading/body,
label/internal path). One shared access-aware image renderer preserves private media rules
and uses Payload derivatives, focal point, explicit dimensions and native lazy loading.
A two-image gallery uses two columns automatically. No new client JavaScript or libraries.
Remove hard-coded promotional copy/navigation inside reusable blocks; copy comes from CMS.

R-1: Payload blocks are the source of truth; generated types and a generated additive SQL
migration include draft/version tables. CTA accepts only root or one lowercase slug path,
matching the current frontend routes; no external schemes, protocol-relative URLs, query
strings or arbitrary anchors. Renderer also fails closed for unsafe draft link data.
R-2: Shared heading rule uses h1 for the first block, h2 for following blocks and h3 for
service cards. CSS grid collapses to one column. Reversal uses CSS placement without
changing reading order. Warm paper, dark muted ink and system serif remain provisional.
R-3: Existing field names/slugs stay stable. No changes to storage/auth or hosted setup;
new images use the same public-or-verified-editor check. Migration is local-only here.
R-4: PR #3 merged into develop; deleting its branch closed stacked PR #4. A replacement
PR targets develop without merging or recreating that branch. Spec 004 supersedes the
initial manual-only restriction with automatic read-only synthetic previews.

## Tradeoffs and verification

A content-only services list avoids premature service collections, pricing and booking.
Testimonials wait for authentic approved content. A sample fixture uses synthetic images
and explicit placeholder text rather than fabricated client quotes or portfolio claims.
API integration tests cover persisted blocks/validation/drafts. Playwright exercises the
real editor, preview, desktop/mobile layout, link navigation and private image behavior.
Existing tests protect the foundation. Inspect screenshots before reporting visual QA.
