# Automatic PR previews

Axel authorized automatic PR/commit previews on 2026-10-05. The default is a **read-only
synthetic frontend preview** of every reusable block, not an editable hosted CMS.
The existing ContentBlocks renderer serves `/` and `/blocks`, using two tiny local WebP
colour studies and explicit placeholder copy. A notice on each page states the limitation.
CMS, API and authenticated draft entry remain 503; unknown sample pages are 404; noindex
and Vercel Authentication stay enabled. No migration or CMS credentials are needed.

## Native operator coordination

Use only studio-lunia (`prj_RiVoPaLLyHgqAwR2Hivx3X2hRTAM`) under team
`team_x4WNnHtFU7Uuf4bAgWyWXRLR`. Never edit vivianne-fotografie or its domains.

1. Verify Git is connected to AxelOord/studio-lunia, root `.`, Node 24.x, install `npm ci`,
   build `npm run build`, framework Next.js. Keep production branch master unchanged.
2. Verify general **Preview** configuration contains `LUNIA_SHOWCASE=true` and no CMS
   secrets. Inspect metadata only. Existing sensitive variables remain restricted to the
   deleted `feature/hosted-cms-preview` branch; do not recreate it or copy/re-scope values.
3. Keep Authentication enabled, PR deployment comments/checks available, and ensure no
   project-level ignored-build setting suppresses trusted feature branch builds. Retain
   Vercel's approval policy for untrusted fork code; never bypass it with a deploy token.
4. The repository config excludes master, develop and the legacy credential-scoped CMS
   branch. All unspecified feature branches deploy by Vercel's default. Do not add a
   wildcard true rule: any matching true rule overrides a false exclusion.
5. After coordination, push the commit and open the replacement draft PR to develop.
   Verify the automatic deployment's project, Git SHA, branch and preview target before
   accepting READY. If Git delivery did not trigger it, investigate the Git check/settings;
   a manual one-off deployment alone does not prove automatic previews work.
6. In an authenticated browser, verify the read-only notice, all six blocks and loaded
   images at desktop/mobile widths, `/blocks` and return navigation, noindex, and CMS/API
   503 responses. Record the exact URL/SHA/deployment and keep hosted CMS acceptance separate.

Vercel Git also builds eligible branch pushes without a PR; this setup is not PR-only.
Production builds remain rejected by application configuration and no custom domain is added.
Future PRs must branch from a base containing these changes; until merged, the old base
still has its earlier sample/config. No merge is implied by this authorization.

Official branch-rule semantics: [Vercel Git configuration](https://vercel.com/docs/project-configuration/git-configuration#git.deploymentenabled).

## Full CMS previews need separate approval

To make each trusted branch independently editable, first define isolated database branches
and runtime roles, private media isolation, short-lived or branch-scoped secrets, editor
bootstrap/session policy, fixed branch origins and recipient allowlists. Provisioning,
credential creation/access and any broader secret scope require explicit approval.
Untrusted forks must never inherit these credentials. Sharing a writable database/media
store between arbitrary PRs is not isolation.

For the blocks change, hosted CMS additionally needs the reviewed
`20261005_065653_reusable_page_blocks` migration (eight tables and two enums), a verified
pre-migration backup, operator execution, runtime grants and post-migration checks. Runtime
credentials cannot perform DDL. Do not reuse an owner URL or put credentials into chat,
CI or deployment arguments. Do not rerun the first-editor bootstrap. PR3's access/reset/
coordinated restore acceptance remains open even if the synthetic preview succeeds.

## Validation evidence

`npm run test:showcase` starts the built app with empty CMS secret variables, checks
blocked routes and noindex, then uses Chromium to decode all four rendered images,
navigate both pages and capture `test-results/showcase-1440.png` and `showcase-390.png`.
Use `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium` for local system Chromium;
CI installs Chromium before this step and retains screenshots in browser-evidence.
Exact-head CI and real external deployment evidence are recorded in the replacement PR.
