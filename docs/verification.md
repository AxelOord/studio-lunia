# Foundation verification

Local environment: Node 24.19.0, npm 11.9.0, PostgreSQL 17 container, Linux Chromium.
Payload and official adapters/UI: exactly 4.0.0-canary.37. Next.js 16.3.8 and React 19.2.6.

- Clean `npm ci`: passed; exact-version admin font patch applies.
- `npm run check`: lint (zero warnings), TypeScript, 5 unit tests, 10 workflow tests and spec structure passed.
- `npm run db:migrate`: initial schema applied to an empty local PostgreSQL database.
- `npm run seed`: first editor/sample page created; repeat preserves existing records.
- `npm run test:integration`: 4 passed (access, draft publication, image derivatives, bootstrap guard).
- `npm run build`: passed after replacing canary admin Google font downloads with system fonts.
- `npm run test:e2e`: 4 scenarios cover desktop/mobile, rejected anonymous access,
  editor login/admin/protected preview, and private versus public upload URLs.
- `npm run test:showcase`: sample home 200/noindex; admin/API/preview 503 with no database or secrets.
- Screenshots reviewed for desktop/mobile composition, overflow, focus, admin and draft content.
  Browser tests check page errors; this is not a complete WCAG audit or field performance study.
- agent-browser CLI was attempted but its container Chromium sandbox startup failed;
  actual browser evidence comes from the passing Playwright/System Chromium suite.

A browser test caught a bind-address redirect (0.0.0.0); preview now uses a validated
relative Location and the rerun passed. Mobile screenshot focus state and a missing arrow
glyph were corrected; admin system font variables and default avatar avoid external assets.

## Dependency risk

`npm audit --omit=dev` on 2026-10-04 reports 11 entries: 0 critical, 4 high, 5 moderate,
2 low (including parent-package propagation). The critical Next ImageResponse advisory
was removed by moving from 16.3.3 to 16.3.8. Remaining chains include Payload's pinned
Sass → chokidar → braces (nested-pattern denial of service), Drizzle tooling → esbuild
(development-server exposure), and Monaco → DOMPurify (specific in-place hook XSS).
A compatible automatic fix is not available for the high/moderate Payload dependency
chains; the DOMPurify version is pinned within upstream Monaco. No force upgrade or
untested transitive override was applied. There is no public user code/pattern editor,
no esbuild dev server, and hosted CMS is disabled. Review/upstream remediation is still
required before a real CMS launch; passing tests do not establish production security.

## External verification

Draft PR #1 is open and the separate studio-lunia Vercel project is configured after
explicit authorization and GitHub App access. No production or domain change occurred.
See docs/vercel.md; final preview and exact-head CI results are reported in the PR/task.
Push and PR CI passed on foundation commit 96e79fba90efe853f6f6cbad8693187548d969b2.

## Visual evidence

- [Desktop](evidence/home-desktop.png)
- [Mobile](evidence/home-mobile.png)
- [CMS admin](evidence/admin.png)
- [Authenticated draft preview](evidence/draft-preview.png)
