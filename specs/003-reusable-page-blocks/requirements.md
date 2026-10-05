# Reusable editorial page blocks

Workflow: requirements-first
Status: ready

## Goal and scope

An editor can assemble a photography page from existing hero, text and gallery blocks,
plus image/text, service cards and a call to action. Provisional warm muted styling,
spacious images and system serif headings support content review before logos, fonts,
photos and copy are supplied. English UI/docs and explicitly synthetic test content.
No testimonials without approved quotes; no booking, tracking or hosted infrastructure work.

### R-1: Composable editor content

Editors can add, edit, reorder and save the six block types through Payload and see them
in authenticated draft preview. Image/text supports either image side; gallery supports
an image pair without a duplicate block. Service cards have bounded editable title/body
items. CTA label and internal path are editable; unsafe URLs are rejected.
Check: real CMS schema/API round-trip and browser admin edit/save/preview; invalid link/card inputs fail publication.

### R-2: Responsive and accessible rendering

Blocks render in editor order with one first-level heading, meaningful image alt text,
keyboard-visible links and no horizontal overflow at 390px/1440px. Use existing image
sizes and lazy loading below the first block. Plain text is escaped, not interpreted as HTML.
Check: browser image loading, heading order, link navigation, focus, desktop/mobile screenshots and visual review.

### R-3: Preserve content and privacy

Existing blocks, saved drafts, published content and private media access continue to work.
An additive migration creates new block/version tables without rewriting existing content.
Public rendering never reveals private media URLs; authenticated draft preview can render them.
Check: migration on the existing local DB, fresh CI migration, integration and browser access regressions.

### R-4: Isolated review and honest evidence

PR #3 is now merged. Use a replacement draft PR to develop for closed PR #4. Automatic
read-only synthetic previews are authorized under spec 004; no merge or CMS activation. Preserve spec 002's unresolved hosted
checks and distinguish local validation from hosted proof. Run exact-head CI.
Check: base/head and diff review, Vercel branch isolation, test evidence and PR status.

## Open questions

Logos/fonts/photos/copy and final styling remain unconfirmed; no blocker to this structural
slice. Library reference image(6).png is resolved but download failed in this executor;
pixel fidelity cannot be claimed unless materialization succeeds later in this task.
