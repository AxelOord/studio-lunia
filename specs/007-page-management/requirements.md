# Page management

Workflow: requirements-first
Status: ready

## Goal and scope

Help the editor find, change and preview a page using the existing Payload admin.
Implementation approved by Axel on 2026-10-05 through issues #6, #7 and #8.
English repository/UI copy. Based on merged PR5, develop 0a7b495. No custom page builder or admin replacement.

Smallest valuable flow: open an existing page → find its hero → edit the headline →
see the unsaved change in native split preview → switch to Mobile → Save Draft →
confirm the public page is unchanged → explicitly Publish when ready.

### R-1: Find page content and settings

Show two unnamed tabs: Content (existing layout) and Page settings
(existing title, slug and description), grouped as requested in issue #6. Explain that page title/description feed document
metadata while block headings are visible page copy. Page list shows title, slug,
\_status and updatedAt. Do not add a duplicate status field or an empty SEO tab.
Check: locate and edit a headline without moving through settings; edit existing
metadata without changing field paths, block order, page ID or slug unintentionally.

### R-2: Recognizable blocks without extra authoring work

Give all six block types consistent English labels and short field guidance. Avoid
"Untitled" naming noise; collapsed block headers identify type and existing heading
with a useful fallback. Service rows show their existing title. Keep native block
add/reorder/collapse controls and validation. Defaults remain structural (imageSide,
private visibility); never invent biography, services, prices or published text.
Check: distinguish and reorder two blocks of the same type, add each supported type,
and locate required fields with keyboard navigation; existing values remain intact.

### R-3: Useful existing media tools

Retain the existing card thumbnail and native upload/detail UI. Show alt text,
visibility, filename and updatedAt in the media list; explain private/public visibility
and the existing image formats/size limit. Keep storage keys/prefix fields hidden;
retain useful read-only dimensions and file information. Add conditional fields only
where an actual existing choice makes them relevant; no speculative toggles.
Check: find a photo by existing text/filename, distinguish private/public records,
select it in a block and view its thumbnail without exposing storage metadata.

### R-4: Native live split preview while editing

For a saved page, offer Payload's native Live Preview panel, Responsive and Desktop
(1440×900)/Mobile (390×844) viewports. Show unsaved headline/body/image selection and
block order changes without Save, Publish or a manual reload. Use the same block
renderer/styles and authenticated media access as the website. Incomplete new blocks
show a safe empty state instead of crashing. Preview is an aid, not a saved-state claim.
Check: type a distinctive headline, change an image and reorder blocks; changes appear
within roughly one second locally after idle, without increasing stored versions.
Switch viewports without losing form data. Removing a required value does not crash.

### R-5: Explicit saves and preserved access boundaries

Keep native draft/save/publish controls and version history; do not enable autosave
in this slice. Explain that live changes are unsaved until Save Draft and not public
until Publish. On an entirely new page require one initial Save Draft before live
preview; subsequent unsaved edits, including slug edits, must not produce a 404.
Anonymous users must not receive preview data or private media. No preview tokens in
URLs, public client-side access override, wildcard message origins or public preview
listeners. The external session-authenticated preview route remains available.
Check: unsaved/saved draft differs from an independent public session; publish changes
only on explicit action; reload preserves saved content; unauthorized/expired sessions
and foreign-origin messages cannot fetch draft/private data. Unsaved CTA paths remain
non-executable until valid; public rendering gains no live-preview subscription.

### R-6: Preserve existing content and schema

Use unnamed tabs and presentation options; retain field names, block slugs, relations,
IDs, required rules, versions and database/storage configuration. Add only the pinned
matching live-preview package at implementation. No migration is expected
from the proposed presentation changes; verify rather than assume a zero schema diff.
Check: generated types/schema comparison and representative existing six-block pages,
media and drafts round-trip unchanged apart from explicit editor edits.

## Accepted decisions and exclusions

Recommend client-side form-state preview inside Payload's native panel, preserving
explicit Save Draft. Server refresh with autosave is an alternative only after an
explicit behavior decision; a save-only refresh does not satisfy R-4.

Exclude new SEO fields/plugin, custom canvas/builder, new blocks, rich text migration,
click-to-edit overlays, responsive content variants, autosave/scheduled publishing,
roles/approval workflow, translations, booking, tracking, branding redesign and hosting
changes. A mobile preview viewport does not claim full mobile-admin or device QA.
Existing hosted anonymous-file/mobile/restore acceptance gaps remain separate.
