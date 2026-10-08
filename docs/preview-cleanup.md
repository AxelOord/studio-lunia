# Closed PR preview cleanup (activation disabled)

Related: [issue #46](https://github.com/AxelOord/studio-lunia/issues/46),
[draft PR #47](https://github.com/AxelOord/studio-lunia/pull/47) and
[specification](../specs/preview-cleanup/requirements.md).

The controller implements planning, exact-ID Vercel deletion, scheduled reconciliation and
read-only native Neon observation. **Destructive execution remains disabled.** The committed
[activation policy](../scripts/preview-cleanup-policy.json) has `executionEnabled=false`,
no closure cutoff and no native project IDs. Neither an apply flag nor variables can bypass
that policy. The real HTTP adapter is exercised only through owned fake transports in tests.
No live cleanup, credential setup, resource retry or provider setting change was performed.

## Scope and eligibility

Fixed scope: `AxelOord/studio-lunia` (repository ID `1404604205`), Vercel project
`prj_RiVoPaLLyHgqAwR2Hivx3X2hRTAM`, team `team_x4WNnHtFU7Uuf4bAgWyWXRLR`.
Canonical project/repository links must agree. Every deletion requires all of these:

- A currently closed or merged same-repository PR into `develop`, whose Git head ref is
  absent. Retaining the ref retains its preview. The controller never deletes Git refs.
- No other PR ever using that head, no open PR based on it and no fork/missing ownership.
  `main`, `master`, `develop`, `hosted-cms-preview` path segments, `release/` and `shared/`
  refs are protected. A closure cutoff excludes historic work; a settling interval defaults
  to 24 hours and must be at least one hour after the latest closure.
- Every deployment on the exact full branch belongs to the fixed project/repository,
  carries an immutable repository ID in native Git provenance, is a native terminal preview
  with null target, was created before closure and belongs to the sole PR's commit history.
  Conflicting metadata, custom/production targets, active deployments, incomplete history
  (including GitHub's 250-commit cap) or ambiguous pagination block the whole branch.
- Complete project targets are available and no candidate is a current project target.
  Every candidate's complete alias list must be empty. **All assigned aliases, including
  `vercel.app` aliases, block cleanup.** The alias endpoint does not establish disposability;
  the controller never guesses from a generated-looking hostname or removes aliases.
- For apply mode, the reviewed native Neon project/organization/source branch must match.
  The documented exact `preview/<full-git-ref>` name must identify a single non-default,
  unprotected child of that source, with no children. Its immutable ID stays fixed during
  execution. Existing Vercel deployments with no matching native branch block deletion.

The native project mapping also requires owner confirmation that it is exclusive to this
Vercel preview integration. The Neon API cannot prove that a branch is unused by some external
project/connection. No database connection strings are inspected. IDs remain unconfigured
until that mapping and exclusivity can be reviewed. No direct Neon, Blob, project, alias or
production deletion exists.

## Execution and recovery

The Vercel adapter calls only `DELETE /v13/deployments/<exact-id>?teamId=<fixed-team>`.
It removes oldest first, including the last qualifying deployment; no force option, URL
alias or automatic write retry is used. A matching `DELETED` receipt or exact 404 is handled
idempotently. Authentication errors, ambiguous receipts, timeouts and lost responses stop
with a sanitized progress journal. A new run inventories actual state rather than replaying
an old deletion list.

The controller rebuilds the full plan before every deletion. Remaining inventory may shrink;
it cannot gain or change a deployment. GitHub ownership checks run again after provider reads
so a reopen/ref recreation/shared PR discovered during those reads prevents deletion. An
exclusive local lock and one non-cancelling Actions group serialize controller runs. After a
local crash, verify the process has stopped before removing its temporary lock file.

An hourly default-branch reconciliation scans every closed PR after the approved cutoff and
uses the same fresh guards. It recovers displaced pending Actions events, branch removal
after closure and builds that finish later. Retained/protected branches remain blocked.
Uncertain execution stops the batch, preserving earlier results; the next run reconciles anew.
GitHub scheduling is best effort and public-repository inactivity can disable schedules.

Final Vercel absence is verified independently of the native database. A paginated read-only
Neon inventory reports `cleanup-verified` only when both are absent, `native-cleanup-pending`
when the mapped branch remains, and `unverified` on errors. A later scheduled/manual run can
observe delayed cleanup without issuing another DELETE. Absence is not a claim about reclaimed
billing/quota, recovery windows or backups. There is no direct Neon deletion fallback.

**Cross-provider atomicity remains unavailable.** A user can reopen/recreate a branch, promote
or alias a deployment, or trigger another build after the final check. A settling interval and
serialization do not lock external actors. Activation needs an approved operational quiescence
policy and separate provider acceptance; tests do not prove this final race impossible.

## Approval and management access (not configured)

The code path is implemented; operational setup remains separate:

1. Owner approves synthetic preview data loss, closure cutoff, settling/quiescence policy,
   exact native project/organization/source IDs and exclusive integration use. Review the
   policy change enabling execution; do not backdate the cutoff to sweep historic previews.
2. Owner installs the reviewed workflow on the default branch through the normal release
   process and configures a protected `preview-cleanup` environment with required reviewers
   and a branch restriction to reviewed `master` code. This task changes no such settings.
3. Supply GitHub metadata/PR/contents **read** access and scoped Vercel project, deployment
   and alias **read**, plus deployment **delete** management access. The future environment
   secret is `LUNIA_VERCEL_CLEANUP_TOKEN`. A team token is not necessarily project-isolated;
   validate the actual provider scopes before granting it.
4. Native cleanup uses the existing integration, but **automated verification additionally
   requires Neon management read access** for project/branch inventories, under future secret
   `LUNIA_NEON_CLEANUP_READ_TOKEN`. Vercel-managed Neon CLI/browser login is not an API key.
   Check available least-privilege scopes; do not grant access just to make this draft pass.
5. `LUNIA_PREVIEW_CLEANUP_PLANNING_ENABLED=true` admits the workflow. Mode defaults to `plan`;
   `LUNIA_PREVIEW_CLEANUP_MODE=apply` additionally requires the enabled committed policy and
   `LUNIA_PREVIEW_CLEANUP_APPROVED_SHA` equal to the exact 40-character `GITHUB_SHA`. A new
   default-branch commit stops writes until its SHA is approved. Manual inputs select a PR,
   never execution code or a deletion URL. Local apply is refused.

Existing branch aliases may require a separately approved provider policy or operator
reconciliation before those previews are eligible. This implementation deliberately blocks
them; it does **not** promise unattended deletion of all existing aliased previews. No alias
removal or security/permission change is included here.

Read-only local plan: `npm run preview:cleanup -- --pr 91`, replacing 91 with the intended
closed PR and securely supplying read credentials. No environment-file loader is included.
`npm run test:cleanup` needs no management credentials and makes no external requests.

## Default master versus develop

Default `master` remains the empty baseline `3397973f90bb39e6f143e2982edb94262d677540`;
this draft targets `develop` at `5f1669e8bb490b64e2bd5ee74a63878bea5f67fc`.
Merging into develop alone does not install the lifecycle workflow on master.
The current [GitHub event contract](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request_target)
uses default-branch code for `pull_request_target`; `branches: [develop]` filters the PR base.
Manual dispatch and schedules also require default-branch installation. The job enforces
`refs/heads/master` and checks out the exact `github.sha`. No PR checkout, dependency install,
artifact download or cache restoration occurs (`package-manager-cache: false` is explicit).
Fork close events are skipped before the secret step; canonical fork checks precede Vercel
reads for manually selected PRs. No merge/default-branch/repository-permission change is made.

## Provider evidence and remaining acceptance

[Vercel exact-ID deletion](https://vercel.com/docs/rest-api/deployments/delete-a-deployment),
[complete deployment aliases](https://vercel.com/docs/rest-api/aliases/list-deployment-aliases),
and [Neon branch inventory](https://api-docs.neon.tech/reference/listprojectbranches) define the
adapters. Neon's [official cleanup guide source](https://github.com/neondatabase/website/blob/main/content/docs/guides/vercel-branch-cleanup.md)
confirms last-deployment cleanup. Its table lists Hobby preview retention as 30 days, with
exceptions for recent deployments and custom aliases; a retained deployment can keep a
branch indefinitely. Provider docs were checked on 2026-10-08; no retention setting changed.

All restored previews and PR45 are preserved. The previously reported spare slot is not a
current quota claim. Full local checks and exact-head CI belong to the draft's verification
record. Live permission checks, actual deletion/native cleanup, alias eligibility, operational
quiescence and owner activation remain unverified and unapproved.
