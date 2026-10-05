# Review brief: Pagina’s prettig beheren

Proposal only, 2026-10-05. Improve the existing editor before considering another
builder. Requirements/design/tasks are separate so approval precedes implementation.

## Evidence and current pain points

Repository: https://github.com/AxelOord/studio-lunia. PR5 remains open/draft, targeting
develop; its inspected head is 0970cbd40ee244a136cd99386ea7ee2d7bceee7e (merge of
fab4076 with develop 3f1d2ed). That merge changes none of the inspected editor files.
This spec-only worktree starts from develop and explicitly depends on PR5's six-block
model for later implementation. It does not include or supersede that implementation.

Sources: src/collections/Pages.ts, Media.ts, src/blocks/index.ts, payload.config.ts,
src/lib/pages.ts, ContentBlocks.tsx and the existing preview route, inspected in the
PR5 checkout. Pages contains title/slug/description/layout with drafts and 20 versions;
no tabs, list-column selection or livePreview configuration. Metadata already uses
page title/description. Most blocks lack helpful descriptions, and no heading-derived
label is configured. Media already has card thumbnails, alt text and private/public
visibility; storage fields are already hidden, not a missing security feature.

Visual input is **local**, not a current hosted audit: inspected the existing synthetic
E2E screenshot test-results/blocks-admin.png, generated 2026-10-05 10:08 UTC (1280×2958).
It shows a long expanded six-block form, repeated Heading/Body labels, several Untitled
headers and generic service Item rows. Native Save Draft/Publish controls are already
present; do not replace them. Current hosted audit was unavailable because the editor
session had expired; no fresh hosted screenshots or mobile-admin findings are claimed.
The separate prior hosted functional/persistence evidence is not a visual audit.

## Small proposal and effort

| Change                                                      | Native versus custom effort                                                             |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Content/Page settings tabs, clear labels/help, useful lists | Small configuration change using existing fields                                        |
| Meaningful collapsed block/service labels                   | Native extension points; possibly tiny label components, no new data                    |
| Thumbnails/private visibility clarity                       | Existing upload UI and thumbnail; configure columns/help                                |
| Split preview and desktop/mobile frame                      | Native livePreview settings                                                             |
| Unsaved text/image/block updates                            | Bounded frontend work: official pinned hook, authenticated frame route, shared renderer |
| Robust auth/incomplete drafts/save-state QA                 | Necessary integration tests; main uncertainty, not a new product subsystem              |

The first valuable acceptance flow is edit hero → see unsaved result → Mobile → Save
Draft while public content stays unchanged. Keep manual save/publish; no autosave
surprise. New pages need one initial Save Draft before live preview. No fictional SEO
tab: Page settings exposes only existing title/slug/description responsibilities.
Suggested labels keep stored slugs intact: Hero → Intro / hero, Text → Text section,
Gallery → Photo gallery, Image and text, Service cards, and Call to action. Clarify
Eyebrow as a small optional heading, CTA label as Button text, and its destination as
an internal Page link. Heading-derived collapsed labels should avoid a second manual
block-name field. These are proposed English labels, not new fields or content.

No conditional fields are proposed merely to add complexity; current choices do not
justify them. All UI copy stays English.

## Verified pinned capabilities

Read checkout .agents/skills/payload/SKILL.md and the official bundled canary skill,
including collection/field references. Installed types, rather than generic snippets,
confirm LivePreviewConfig.url/breakpoints/openByDefault; Block admin.Label and
admin.disableBlockName; array RowLabel; unnamed tabs and collection list options.
The plugin's getFields already hides prefix/\_objectKey. Current dependencies do not
include live-preview-react; a read-only registry query confirmed 4.0.0-canary.37 exists.
No dependency was installed or changed.

Version-pinned official references:

- [Native live-preview configuration](https://raw.githubusercontent.com/payloadcms/payload/v4.0.0-canary.37/docs/live-preview/overview.mdx): iframe, relative URLs and breakpoint controls.
- [Client preview](https://raw.githubusercontent.com/payloadcms/payload/v4.0.0-canary.37/docs/live-preview/client.mdx) and [hook source](https://raw.githubusercontent.com/payloadcms/payload/v4.0.0-canary.37/packages/live-preview-react/src/useLivePreview.ts): form-state updates and relationship depth; frontend integration is required.
- [Server preview](https://raw.githubusercontent.com/payloadcms/payload/v4.0.0-canary.37/docs/live-preview/server.mdx): refreshes on save; autosave is a separate behavior choice.
- Installed node_modules/payload/dist/config/types.d.ts, fields/config/types.d.ts,
  collections/config/types.d.ts and versions/types.d.ts provide the exact API checks.

## Migration and boundaries

No expected SQL/data migration: keep existing field paths using unnamed tabs. Compare
schema/types before claiming no migration. No field/block renames, new SEO fields,
content rewrite or data cleanup. The only proposed future dependency is the matching
live-preview package. Preview-only client rendering must not move the public site
into a client-side builder. Auth/media checks must remain real server controls.

No custom canvas, new blocks, rich text, responsive content overrides, approval roles,
localization, autosave, booking, metrics, production changes or additional services.
Hosted anonymous-file denial, real mobile QA and combined DB/media restore gaps from
prior work remain open separately; this document neither closes nor enlarges them.

## Review delivery / no-deployment constraint

Only these Markdown spec files are prepared. Runtime, config, dependencies, provider
settings and data are untouched. No tests/build need rerunning for prose-only work;
run the spec structural checker, Markdown formatter and diff check.

An ordinary new branch is deployment-enabled by the current vercel.json. The
[official Git configuration](https://vercel.com/docs/project-configuration/git-configuration)
confirms unspecified branches default to enabled. No documented commit-message bypass
was verified. Therefore keep this spec branch local rather than accidentally deploy,
reuse a legacy credential-scoped branch or change hosting settings without scope.
A spec-only draft PR against develop can follow once its exact branch is explicitly
excluded from deployment through an approved mechanism. No merge is needed to review
these local files, and no deployment is needed for this proposal.
