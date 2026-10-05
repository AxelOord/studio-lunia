# Proposed design — configuration first

## R-1 / R-2 / R-3: Native admin configuration

Change only collection/block admin presentation first: unnamed tabs, labels,
descriptions, defaultColumns, listSearchableFields, initCollapsed and native controls.
The installed Block type supports admin.disableBlockName and admin.components.Label;
array rows support admin.components.RowLabel. If heading/title-derived labels need
components, use one small read-only label helper per native extension point. Do not
replace the entire Block component or store duplicate display-label fields.

Page settings groups the existing title, slug and description as requested in issue #6; there
is no new SEO model. Do not bury validation or Save/Publish controls. Media already
has adminThumbnail='card', required alt and default private visibility; improve their
presentation rather than replacing the asset manager. Storage metadata is already
hidden by the plugin and must remain so. No existing field currently justifies a new
conditional toggle: omit conditional behavior unless the implementation review finds
a concrete dependency, and never treat UI hiding as authorization.

## R-4 / R-5: Native preview shell, bounded frontend integration

Verified native knobs: collection admin.livePreview.url, breakpoints and openByDefault.
Recommend openByDefault=false so preview does not consume workspace without request;
use the native toggle, width controls and mobile preset. A narrow editor window can
close preview without losing work. The existing chain-link control copies on click
and opens on Ctrl/Cmd-click; explain it, do not confuse it with the new split toggle.

The current server-rendered frontend has no listener for live messages. A collection
setting alone cannot show unsaved changes. Prefer @payloadcms/live-preview-react
4.0.0-canary.37 useLivePreview in a preview-only client wrapper around shared blocks.
The matching pinned package is installed.
Initial page and populated media load on an authenticated server path with
user + overrideAccess:false. Keep relationship population depth consistent (currently
2), verify same-origin credentialed population and signed private-image reads.
Do not serialize the user/session/secret into preview props.

Use a dedicated authenticated live-preview route keyed by persisted page ID, not an
unsaved slug. That avoids breaking the iframe when the editor changes a slug and
avoids relying on a global draft cookie for this new panel. Preserve /preview?slug=…
for the existing external preview. For a page without an ID, explain the one-time
Save Draft prerequisite. Each live-preview server read must authenticate; message
handling must validate the admin origin and expected document context. Verify logout
and expired-session behavior, iframe restrictions and Vercel protection on the actual
same-origin branch/deployment URLs. Do not relax CSP or CORS globally to make it work.

Render incomplete form state defensively: safe empty layouts, missing images/headings,
removed rows and invalid draft CTA paths. Text remains escaped and invalid CTA URLs
must not become actionable. Reuse website markup/styles, but load the listener and
client wrapper only in authenticated preview; normal public pages remain server-led.
Changes in the live frame are not writes and do not replace Save Draft or Publish.

Alternative: native RefreshRouteOnSave keeps rendering fully server-based, but only
refreshes saved data. Autosave would make that feel live while changing persistence,
Save Draft visibility, request frequency and version behavior. Defer that alternative;
do not silently substitute it or implement a custom message protocol/builder.

## R-6: Data/migration impact and review sequence

Unnamed tabs preserve data paths. Named tabs/groups would nest data and are excluded.
Labels, list columns and collapsed-state configuration should not alter SQL. Confirm
by comparing generated schema/types and existing content; if a migration appears,
stop and explain the cause before expanding this spec. Do not enable schema push.

Approved implementation sequence: (1) admin configuration and labels; (2) native
split preview plus thin frontend bridge and its access/unsaved-state tests. These related changes share a reviewable draft PR because the same native editor flow verifies them.
Issues #6–#8 and the user instruction authorize implementation and automatic CMS previews. No new resource, credential or hosted service is needed by the design.

The canary hook supports a custom population handler. Route it through an authenticated
read-only endpoint with fixed page ID/depth and explicit same-origin checks. Native
public page reads alone cannot detect an expired editor session on a published page.
Accept messages only from the editor frame/opener for this page. Prefer the latest
response when population requests overlap; failed authorization hides the preview.
