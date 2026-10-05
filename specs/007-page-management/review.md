# Page management — implementation evidence

Axel approved issues #6, #7 and #8 and automatic full CMS previews on 2026-10-05.
Their descriptions and all comment endpoints were read before work; all three had
zero comments. PR5 is merged into develop at `0a7b495`. The earlier local spec commit
was rebased onto that base on `feature/page-management`. The previous spec-only
no-deployment restriction is superseded by the explicit implementation instruction.

Issue #6 maps to R-1/R-2/R-6, #7 to R-4/R-5/R-6, and #8 to R-3/R-6. One draft PR
keeps the connected editor/preview flow reviewable together. No issue is closed by
this draft. Production, the old photography project, providers and credentials are
unchanged.

## Implemented behavior

- Unnamed Content and Page settings tabs preserve existing field paths. Title,
  slug and description are grouped as requested in #6. Native slug locking remains.
- Native block labels use type and heading; service rows use title. Native add,
  collapse, reorder and validation remain. There is no duplicate label data.
- Media uses filename as its title and searches filename/alt. Existing thumbnails,
  alt, visibility and timestamp columns are shown in native lists/selection. All
  three image field locations retain native remove/choose/edit controls.
- Native split preview uses the matching `@payloadcms/live-preview-react`
  `4.0.0-canary.37`. Desktop is 1440×900; Mobile is 390×844. The persisted page ID
  selects the frame so an unsaved slug change cannot break its URL.
- Initial reads authenticate the editor and use `overrideAccess: false`. The hook's
  supported custom handler calls a same-origin, authenticated, read-only population
  endpoint with fixed collection/ID/depth. This also rejects expired editor sessions
  for already published pages. It never saves, publishes or creates versions.
- Messages are bounded to the editor frame/opener, origin, collection and document.
  Older population responses cannot overwrite newer edits. Missing form values and
  empty layouts render safely; invalid CTA destinations remain inert.
- New pages explain the first Save Draft prerequisite. No autosave is enabled. The
  normal public renderer gains no message listener; external draft preview remains.

## Local verification — synthetic data only

A separate local PostgreSQL database `lunia_admin_dev` preserves earlier work.
No hosted credential was used. Generated types retain the same data paths and block
slugs; changes are field order and descriptive comments. Running
`npm run db:migrate:create -- page-management-check --skip-empty` generated neither
UP/DOWN SQL nor migration files. The CLI reports `Cancelled` for its empty result;
`src/migrations` remains unchanged.

Checks completed: `npm run check` (15 JavaScript and 35 workflow tests, lint/types/spec
checks), `npm run build`, `npm run format:check`, and all 14 integration tests. Existing
five browser tests pass; five new browser tests cover the connected editor flow:

- unsaved heading updates across all six types, service text, incomplete body/CTA,
  image replacement/removal in hero/gallery/image-text and native block reordering;
- unchanged stored page/version count, independent public output, explicit Save Draft,
  reload and Publish; changed slug and document navigation;
- native viewport widths, media filename search/selection, thumbnails/alt/visibility,
  page settings and first-save instructions;
- anonymous and foreign-origin denial, private original-file denial, wrong message
  origins/documents/senders, expired session and hidden failed preview;
- delayed overlapping responses, all six incomplete blocks and an empty layout.

Synthetic screenshots in ignored `test-results/`: `page-management-desktop.png`,
`page-management-mobile.png`, `page-management-media.png`; inspect them as local
browser evidence. Desktop uses the native expanded panel at 100% zoom; Mobile uses split preview.
The pinned canary divides device width by zoom, so zooming out changes the CSS
viewport width and still crops a large preset in a narrow panel. Use 100% and
Expand for accurate desktop review; no upstream UI patch is included.
Existing public mobile/keyboard checks remain. Test teardown now explicitly closes
PostgreSQL pools, matching the existing preview-bootstrap cleanup.

## Hosted acceptance

Automatic full CMS preview and exact-head CI follow the branch push. Record their
links in the PR; they are not yet claimed here. Authenticated hosted visual checks
may require Axel's existing browser session / first password reset for the new branch.
No credentials are requested or copied. Earlier hosted restore/anonymous-media/mobile
acceptance gaps remain separate; local tests do not close them.

## Version-matched sources

The checkout Payload skill and bundled canary skill were read. Installed config,
field and collection types and native preview/hook source were used for the actual
extension points, authenticated population and message behavior.

- [Native configuration](https://raw.githubusercontent.com/payloadcms/payload/v4.0.0-canary.37/docs/live-preview/overview.mdx)
- [Client preview](https://raw.githubusercontent.com/payloadcms/payload/v4.0.0-canary.37/docs/live-preview/client.mdx)
- [Pinned hook source](https://raw.githubusercontent.com/payloadcms/payload/v4.0.0-canary.37/packages/live-preview-react/src/useLivePreview.ts)
