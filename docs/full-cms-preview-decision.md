# Full CMS automatic previews — decision for approval

The requested outcome is the entire functioning site, including editor login, uploads,
drafts, publication and recovery, on every trusted PR preview. The 9914fd4 showcase is
an interim artifact only and does not satisfy that outcome. Nothing here activates access.

## Current evidence

The studio-lunia Vercel Git integration works automatically. General Preview configuration
has LUNIA_SHOWCASE=true; CMS secrets/flags still target the deleted hosted-cms-preview
branch. The existing restricted runtime role has no schema CREATE permission. The app
requires an exact configured branch, fixed CMS origin and approved email recipient. The
private upload adapter requires a store read/write token to sign client upload receipts;
its fixed preview-media prefix is not a provider-level boundary between PRs. PR5's block
migration is local/CI verified, not hosted-applied. No old-site or production change is needed.

## Native discovery update

Native operator confirmed the existing Neon installation icfg_Fm5d7qbto1ea4ozoIgeV58by,
plan free_v3, currently has no connected projects. Connect Project supports Preview-only
connection and automatic database branching, but does not expose parent/database/role
selection. No connection was saved. This is not evidence that injected credentials use
lunia_runtime or the intended lunia_preview database. Do not commit the connection until
those properties and migration/runtime separation are proven. If not supported, use the
controlled API workflow below on the existing resource rather than a new account.

## Recommendation

Use one trusted orchestration workflow, not a new running service. Let it prepare one
isolated preview environment per PR, then deploy the exact tested SHA to studio-lunia.
Keep the approved editor's work across commits in that PR. Serialize updates per PR and
use the existing advisory lock for migration. Check the current head again before deploy
so a slower obsolete job cannot replace a newer preview. Migration failure retains the
last working preview and reports a failed check, never a successful showcase substitute.

1. Reuse the existing Vercel-managed Neon resource after approving project-level automation
   access; create a synthetic preview template and an isolated database branch per PR.
   Confirm the actual parent/database/role first; do not assume the Connect Project dialog
   selects lunia_preview or lunia_runtime. Do not clone customer data or existing sessions.
2. Provision one private Blob store/token per PR. Keep existing private adapter behavior;
   no public bucket, shared store token or mere prefix masquerading as isolation.
3. In a trusted control job, obtain an ephemeral branch-specific migration connection,
   snapshot before changes, run committed migrations and verify restricted runtime grants.
   Database management and migration credentials must never be injected into Vercel runtime.
   PR code/migrations receive only their isolated DB capability in a separate process/job,
   never project-management or deployment keys. Start with additive migrations; destructive
   schema changes require an explicit reset/recovery decision while editing is quiesced.
4. Seed approved synthetic content and exactly one editor idempotently. A one-time preview
   editor credential is set by Axel through the protected setup path, never in chat/logs.
   Preserve that editor's password/content on later commits; do not reopen first-user signup.
   Generate a separate Payload signing secret per PR; clear inherited sessions/reset tokens.
5. Set branch-scoped runtime DB, Blob, Payload and approved mail configuration using the
   provider API, then deploy only after readiness. Set CMS origin to the actual trusted
   branch alias returned by Vercel, never a guessed slug or caller-supplied Host header.
   Ensure redirects, CSRF, draft preview and reset links all use that same origin.
6. Keep the approved Resend sender/recipient allowlist for real reset delivery. Explicit
   approval is needed to supply preview mail access to more trusted branches; no customer
   recipients, invented domains or DNS changes. App-level recipient limits do not make a
   stolen send key harmless, so only trusted code gets it; verify provider key scope.
7. Verify login, real uploaded pixels, draft/public access, redeploy persistence and a
   mailbox reset before calling the new mode accepted. Revoke and delete only manifest-
   owned PR resources after the approved retention; never match resources by loose prefix.

A DB per PR removes cross-PR schema races. Old deployment URLs in the same PR are not
immutable database snapshots; additive migrations preserve compatibility. If future
requirements demand arbitrary incompatible historical versions, use per-deployment DB
snapshots explicitly rather than pretending a lock solves schema compatibility.

## Why not simply enable the Neon integration?

The current [Vercel-managed Neon integration](https://raw.githubusercontent.com/neondatabase/website/main/content/docs/guides/vercel-managed-integration.md)
can create preview branches and inject pooled/unpooled URLs before deployment. It recommends
build-time migrations, but does not document the migration-versus-runtime privilege split
required here. It cannot coexist with the Neon-managed integration in the same Vercel project.
The [Neon-managed alternative](https://raw.githubusercontent.com/neondatabase/website/main/content/docs/guides/neon-managed-vercel-integration.md)
allows role selection, but changing integration ownership is unnecessary scope and still
requires migration orchestration. Do not enable either on top of the existing manually
restricted DATABASE_URL until a bounded disposable spike proves selected roles, injected
variables, branch reuse, ordering and cleanup. No unsupported native capability is assumed.
[Cleanup is tied to deployment retention](https://raw.githubusercontent.com/neondatabase/website/main/content/docs/guides/vercel-branch-cleanup.md),
not necessarily PR closure, and retention exceptions can keep branches indefinitely.
A controller offers explicit sequencing, restricted runtime and deterministic cleanup.

## Exact approval and handoff bundle

- **Resource authority:** reuse the existing Neon project with a synthetic preview template
  and up to three active PR database branches; create/delete private Blob stores for those PRs. Existing Neon/Blob
  legacy preview data are excluded from controller operations, but a Neon project-level key
  can technically access other branches in that project; that scope must be disclosed.
- **Control credentials:** a Neon project-scoped API key if supported by this Vercel-managed
  account, plus the narrowest available Vercel deployment/environment/Blob management access.
  If the available token is team-wide, disclose that scope and obtain explicit approval;
  do not claim a project-ID check in code limits the token's actual authority.
- **Protected automation:** store these only in a protected GitHub environment (or existing
  approved secret store). A trusted workflow revision owns provisioning and cleanup. Forks,
  unreviewed workflow edits and arbitrary PR input never receive management keys. Running
  npm scripts from a PR with management keys in the environment is explicitly prohibited.
- **Application access:** permit only the matching trusted PR deployment to receive its
  restricted DB credential, private store token, Payload secret and approved send-only mail
  capability. This is new branch access and needs approval; no existing secrets are read or
  copied into chat, local .env, CI artifacts or command arguments.
- **Bootstrap:** privately provide the approved preview-editor setup input once, or approve
  a one-time invitation/reset bootstrap. Preserve credentials thereafter. Existing editor
  passwords cannot be inferred or exported from another preview.
- **Lifecycle/budget:** proposed max three active PRs, synthetic uploads <=100 MB per PR,
  scale-to-zero, cleanup seven days after PR close, preserve open PR data. No paid upgrades,
  trials or overage. Fail visibly at the cap instead of deleting active work or incurring spend.
- **Deployment authority:** replace the direct full-CMS Git build trigger with the gated
  automatic pipeline once tested, avoiding duplicate/racing deploys. Preview only, no merge,
  old-site changes, production credentials or domain changes. CI workflow installation on
  its trusted event/default branch still needs a reviewed merge by Axel; do not silently
  install privileged pull_request_target execution of PR code.

Provider values are handed off privately by Axel/native setup. The agent receives only
resource IDs, scope metadata and success/failure. No old owner URL is reused.

## Cost envelope — primary docs checked 2026-10-05

[Neon plans](https://raw.githubusercontent.com/neondatabase/website/main/content/docs/introduction/plans.md)
list Free at $0, 10 branches/project, 100 CU-hours/project/month and 1 GB DB storage/project.
Three PRs using 0.25 CU for 20 active hours each would total 15 CU-hours, excluding template
and other use. This is an example, not a guarantee. Launch lists $0.106/CU-hour,
$0.35/GB-month and $1.50 per excess branch-month. Confirm actual Marketplace allowances;
no plan change is approved and integration-level plan changes may affect other databases.

[Blob pricing](https://vercel.com/docs/vercel-blob/usage-and-pricing) lists Hobby allowances
of 1 GB storage, 10 GB transfer, 10,000 simple and 2,000 advanced operations. Store count
itself is not the storage charge; creation counts as an operation. Private reads also use
function/CDN delivery. [Resend Free](https://resend.com/pricing) lists 3,000 emails/month,
100/day. Existing account usage, Vercel builds/functions and GitHub Actions must be included.
A $0 incremental target is plausible within verified free allowances, not a promised
unlimited full-CMS service. Stop for a separate budget decision if capacity is insufficient.

## Safe preparation versus activation

This decision and spec 005 are repository preparation only. No active workflow, connection,
credential, migration, resource deletion or production change has been made. Next is the
approval/handoff above and a disposable provider spike, followed by tested automation and
an exact-head full-CMS acceptance run. Spec002 acceptance gaps remain independent and open.
