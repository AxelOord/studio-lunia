# AI tooling and provenance

Verified 2026-10-04. Official AI tooling guide:
https://payloadcms.com/docs/v4/getting-started/ai-tooling.md.
Use https://payloadcms.com/docs/v4/llms.txt and topic Markdown pages; the full reference
is https://payloadcms.com/docs/v4/llms-full.txt. Root llms-full.txt describes v3.
The v4 index could not be fetched by this executor; tagged source and installed types
were inspected instead. Parent independently verified the versioned AI guide.

The official skill ships in `payload@4.0.0-canary.37` at
`node_modules/payload/skills/payload/SKILL.md`; `.agents/skills/payload/SKILL.md` routes
agents there. Its code is pinned by package-lock.json. We inspected and discarded the
main-tracking payloadcms/skills copy because it contained v3 advice. Important v4
changes: Local API access is enforced by default, slugs use native type `slug`, and
`payload build` generates types/import maps. Explicit `overrideAccess: false` remains
our readable policy for visitor/user operations; only bootstrap/tests bypass deliberately.

Official MCP: https://payloadcms.com/docs/v4/plugins/mcp.md. This is CMS data/action
access, not docs search. It is not enabled, and no MCP keys, grants or bypass are added.
No official hosted docs-only endpoint was verified. The versioned docs and bundled skill
provide coding context without persistent service access or a third-party MCP.

Starter: payloadcms/payload tag v4.0.0-canary.37, commit
f88f502514a4acaff83610c504539becdfa938f4, templates/blank (MIT).
Spec checker/templates adapted from AxelOord/lil-dot-bots-playground. No Kiro service
or AI API is required. The offline checker validates structure, not evidence truth.

## Canary compatibility patch

The canary Next admin adapter unconditionally imports Google fonts, blocking builds
when fonts.googleapis.com is unavailable. `patches/@payloadcms+next+4.0.0-canary.37.patch`
removes only those loaders so the admin uses CSS system fallbacks. `patch-package`
applies the exact-version patch after install; revisit it on every Payload update.
No authentication, access control or CMS behavior is patched.

Next.js was advanced from the tagged starter's 16.3.3 to 16.3.8 after npm audit
reported GHSA-vcvr-r3jv-pc5j (next/og ImageResponse RCE; patched in 16.3.6).
16.3.8 remains within canary.37's declared >=16.2.6 <17 peer range.
