# Separate Vercel preview

The existing `vivianne-fotografie` project (`prj_Rs9CBzKKY1RZ948DuydK7s4ef5iC`)
and lunia-photography.nl / www.lunia-photography.nl are the old site. Do not modify,
relink, replace, promote over or transfer its domains. Team: `team_x4WNnHtFU7Uuf4bAgWyWXRLR`.
Read-only inspection on 2026-10-04 found no project linked to AxelOord/studio-lunia.

Desired new project: `studio-lunia`, repository AxelOord/studio-lunia, root `.`,
Next.js framework, Node 24.x, `npm ci`, `npm run build`, default Next output.
Use the team's existing default preview protection; never weaken it for automation.
Set only `LUNIA_SHOWCASE=true` in the **preview** environment for this foundation.
That is a non-secret switch: public sample page works, CMS/API/preview routes return 503.
No database, credentials or tracking are provisioned. No custom domains are attached.

`vercel.json` disables master/develop Git deployments. Production builds also fail
explicitly in the Payload config. Feature branch pushes may generate preview builds
once linkage is authorized/configured. Do not set production environment variables
or promote a preview. No token-based deployment workflow is added to GitHub CI.

## Configured preview project

Created separately after explicit user authorization and the user's GitHub App access grant:
`studio-lunia` (`prj_RiVoPaLLyHgqAwR2Hivx3X2hRTAM`), linked to AxelOord/studio-lunia.
Root is the repository root (null Vercel rootDirectory), framework Next.js, Node 24.x,
install `npm ci`, build `npm run build`. Preview-only `LUNIA_SHOWCASE=true` is configured.
Default Vercel Authentication remains enabled (`all_except_custom_domains`); no protection
was weakened. No custom domains or production secrets were added.

The creation tool initially attempts a preview of empty master; the application preview
must use feature/payload-foundation. Production branch remains master, where Git deployments
are disabled by this PR's vercel.json once that config exists on the branch. The app also
explicitly rejects Vercel production builds. PR: https://github.com/AxelOord/studio-lunia/pull/1.
Final deployment and exact-head CI results are recorded in the PR/task report.

## Before hosted CMS mode

Choose durable PostgreSQL and media storage, scope secrets to the intended environment,
review migrations/backup/restore, configure email, provision an editor through a protected
bootstrap process and exercise drafts/uploads/access tests against that environment.
Local `media/` and container PostgreSQL are development resources, not hosted persistence.
The hosted-CMS guard must be removed only in the spec that verifies those prerequisites.
