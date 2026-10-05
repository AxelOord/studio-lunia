# Design

R-1: Remove only the feature/reusable-page-blocks auto-deploy exclusion. Vercel deploys
unspecified branches by default. Keep exact false rules for master, develop and the
legacy credential-scoped CMS branch. Never use a wildcard true: any matching true rule
would override false exclusions. Official reference:
https://vercel.com/docs/project-configuration/git-configuration#git.deploymentenabled

R-2: General Preview already has LUNIA_SHOWCASE=true. Serve a typed static fixture through
the existing ContentBlocks renderer; no CMS calls, migration or storage service. Own tiny
WebP colour studies are explicitly labelled synthetic. The existing proxy blocks CMS paths.
Extend the existing showcase probe to exercise real browser images/navigation/screenshots.

R-3: GitHub timeline records base_ref_deleted then closed for PR4 at 07:21 UTC. Both
retarget and reopen are rejected while that base is absent. A replacement draft targets
develop and preserves all PR4 commits. Existing private CMS configuration remains untouched.
General preview mode is safe only while project settings expose no CMS secrets to these
branches; frontend guards cannot protect secrets injected into an untrusted build.
