# Full CMS automatic previews — approved minimal decision

The requested outcome is a functioning site with editor login, uploads, drafts,
publication and recovery on trusted PR previews. The 9914fd4 showcase is interim
only. Axel approved the access tradeoffs on 2026-10-05. Implementation and exact settings
are documented in [the runbook](full-cms-preview-runbook.md).

## Recommendation: native integration first

Reuse the existing Vercel-managed Neon installation
`icfg_Fm5d7qbto1ea4ozoIgeV58by` on its existing Free `free_v3` plan. Connect only
studio-lunia Preview, with automatic database branching enabled. Keep normal Git
preview deployments. Run committed Payload migrations before the application build,
using the isolated preview branch connection and a database advisory lock. No new
account, API management keys, GitHub provisioning controller or paid plan is needed.

Native inspection confirms Preview-only connection and automatic branching, but no
parent/database/role selector. Before enabling full CMS, inspect the selected parent,
database and injected role without displaying credentials. The source must contain
only approved synthetic preview data, never old-site/customer data. If that cannot
be established, stop and configure a suitable synthetic parent before proceeding.

The integration may supply an owner-capable database credential to both build and
runtime. Accepting that on isolated synthetic previews is the smallest workable
option: compromised preview code could alter/drop its preview database. It must not
receive production connections or provider-management credentials. Restricted runtime
roles plus separate migration orchestration remain an optional hardening step, not
a requirement invented for this initial preview. Verify the actual role scope.

Use one existing private preview-only Blob store and a stable namespace per Git
branch. Enforce namespace ownership in upload signing, reads, updates and deletion,
as well as existing editor/public visibility checks. This separates ordinary app
access; the shared store token still permits trusted server code to access all
preview objects. It is not a provider-enforced security boundary between hostile
PRs. Separate stores are optional if that stronger boundary becomes necessary.

## Small repository changes required

1. Replace the exact deleted-branch CMS gate with the verified Vercel Preview/project
   context; retain production rejection and fork/untrusted-code protections.
2. Add a preview build entrypoint: validate configuration, acquire a migration lock,
   apply committed migrations, perform idempotent synthetic setup, then build. Use
   the integration's direct connection for migrations and pooled connection at runtime
   where available. The existing operator script is manual-only and cannot simply be
   called unchanged: it requires explicit target/backup inputs and rejects reuse of
   bootstrap when an editor exists.
3. Choose a private one-time editor bootstrap or an approved synthetic template with
   an existing preview editor. Preserve credentials/content on rebuild; do not add a
   seed password to every deployment or reopen public first-user registration.
4. Derive the canonical origin from trusted Vercel deployment metadata, verifying the
   actual branch URL; use it consistently for CSRF, draft preview and reset links.
   Replace the hard-coded legacy origin and fixed Blob prefix with branch configuration.
5. Enable CMS and approved preview-only Payload/Blob/mail settings for trusted Preview
   deployments, then remove showcase as the default. Keep the existing approved mail
   recipient restriction. Sharing mail/Payload/Blob capabilities across these previews
   is an explicit access decision, not implicit authorization to read their values.
6. Test two branches, rebuild persistence, login, real uploads, private/public denial,
   draft/publish and actual reset delivery. A failed migration must fail the deployment,
   never silently substitute a showcase. Start with additive migrations: old deployment
   URLs on one Git branch may share its database, so incompatible changes require review.

An advisory lock prevents simultaneous schema mutation; it does not solve incompatible
old/new schemas or guarantee latest-commit promotion. Verify Vercel superseded-build
behavior with two quick commits before claiming automatic previews accepted.

## Exact decision and access handoff

Approve the existing Neon connection to studio-lunia **Preview only**, automatic
branch creation, and migrations with the native injected role even if it is owner-
capable within the synthetic preview branch. Approve trusted previews sharing the
existing private preview Blob token, Payload signing secret and restricted preview
mail capability. This exposes those shared preview capabilities to trusted preview
server code; it grants no production access. Forks/unreviewed external code must not
receive them. The native operator supplies settings privately through provider UI;
no secret values are requested in chat, exported or committed.

Also choose the one-time editor bootstrap/template route privately. The source branch
and selected database must be identified before migrations, so an accidental default
production parent cannot be treated as safe merely because Preview is selected.

Keep current Free limits and provider retention: native inspection reports 10 database
branches and no automatic paid overage, with default preview retention of 30 days.
No three-active-PR cap, seven-day deletion policy or per-PR Blob store is imposed.
Provider cleanup has retention exceptions; surface branch exhaustion and request cleanup
of reviewed disposable previews rather than deleting active work or upgrading. Existing
Blob, email and build usage still counts against account limits. No paid purchases,
production deployment, old-site settings or domain changes are authorized.

## Evidence and alternative

The [native integration documentation](https://raw.githubusercontent.com/neondatabase/website/main/content/docs/guides/vercel-managed-integration.md)
describes automatic preview branches and pooled/direct variables supplied before builds.
[Cleanup documentation](https://raw.githubusercontent.com/neondatabase/website/main/content/docs/guides/vercel-branch-cleanup.md)
explains branch reuse per Git branch and deployment-retention-based cleanup, including
exceptions; PR closure alone does not guarantee immediate deletion.
[Neon Free limits](https://raw.githubusercontent.com/neondatabase/website/main/content/docs/introduction/plans.md)
and [Blob usage](https://vercel.com/docs/vercel-blob/usage-and-pricing) support a bounded
free preview setup, not an unlimited-use promise. Verify actual account consumption.

A custom workflow would enable restricted runtime roles and stronger per-PR capabilities,
but adds management keys, provisioning, cleanup and deployment coordination. Defer it
unless the native setup cannot select a safe synthetic source, or Axel requires stronger
isolation between trusted previews. The earlier controller-first proposal is superseded.

The native operator subsequently connected Preview-only Neon and rescoped approved
preview services without exposing values. Its source inspection found empty neondb
under neondb_owner. Provider activation and hosted acceptance are coordinated separately
from this repository change. Spec002's outstanding acceptance evidence remains open.
