# Closed PR preview cleanup (activation disabled)

Related: [issue #46](https://github.com/AxelOord/studio-lunia/issues/46),
[draft PR #47](https://github.com/AxelOord/studio-lunia/pull/47) and
[specification](../specs/preview-cleanup/requirements.md).

The controller implements planning, exact-ID Vercel deletion, scheduled reconciliation and
read-only native Neon observation. **Destructive execution remains disabled.** The committed
[activation policy](../scripts/preview-cleanup-policy.json) has `executionEnabled=false`,
no closure cutoff and no native project IDs. Ownership registration, consumption, artifact receipts and prospective native alias policy are also disabled; the manifest and adoption-intent list are empty. Neither an apply flag nor variables can bypass
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
  Each assigned alias must have an explicit disposable-preview record in the trusted manifest.
  Its exact UID, hostname, generation observations, project and deployment association must still
  match. User-supplied aliases, configured custom/production/branch domains, known project/author URLs, redirects,
  microfrontends, shared bypasses, conflicting owners and unknown aliases remain protected.
  There is no hostname-based ownership inference or direct alias DELETE.
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

Final Vercel absence is verified independently of the native database. The controller captures
the immutable Neon branch ID before execution and, after the final inventory, reads that exact
ID in the verified project. Only an exact-ID 404 together with no replacement at the original
name establishes `cleanup-verified`. A renamed branch with the same ID remains
`native-cleanup-pending`/`retained`. Inconsistent observations or read errors stay unverified.
The result includes the captured `nativeBranchId` for operator reconciliation.

A trusted manifest record can preserve that native ID across runs. A later run verifies the
same ID even if its name changed; conflicting replacement identities block. Without such a
record, a missing expected name still reports `deployments-absent`/`unverified`. The controller
never consumes prior logs or arbitrary artifacts as deletion authority. Only receipts authenticated
through the approved producer boundary below are accepted. Absence is not a claim
about reclaimed billing/quota, recovery windows or backups. There is no direct Neon deletion fallback.

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
   alias and project-domain **read**, plus deployment **delete** management access. The future environment
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

## Trusted ownership manifest and registration

The implementation now supports ordinary branch aliases through exact ownership records in
[`preview-ownership-manifest.json`](../scripts/preview-ownership-manifest.json), loaded only from
the same reviewed checkout as cleanup code. No runtime manifest path, PR file, arbitrary downloaded artifact
or webhook payload grants authority. Authenticated default-code receipts are an additional
reviewed data source, gated separately by `ownershipReceiptsEnabled`. `ownershipConsumptionEnabled=false` keeps this path disabled.
The committed empty manifest grants no disposal authority to any existing preview.

Each immutable record contains the fixed scope, PR number/creation identity/full ref/observed head,
deployment ID/commit/creation time, alias UID/full hostname/creation and available update timestamp,
registration provenance, and available native Neon ID/project/source identity. A new deployment
needs a new record. Successive bindings of the same alias are permitted only for the same PR/ref;
a different owner or recreated UID for the same hostname is rejected, including collisions caused
by normalization or truncation. Cleanup never follows a stale record to a different deployment.
An old deployment from which an alias has already been removed can still use the alias-free path.

Before each deletion, the complete assigned-alias list must be covered by exact records. The
controller rereads each alias by UID and fully paginates project domains without filtering out
production, redirects or branch domains. Any custom suffix, configured domain, project/author
URL, redirect, microfrontend, shared bypass, missing detail or changed generation/mapping blocks.
The existing protected-ref/project-target/open/shared/reused-PR guards remain mandatory. Alias
checks reduce races but cannot lock an outside actor's changes after the last read.

### Existing previews: concrete reviewed adoption path

The registrar is [`preview-register.mjs`](../scripts/preview-register.mjs). Its operations use
provider reads only; the only write is an atomic local manifest candidate. It does not publish
Git, change aliases, configure accounts or deploy a new controller.

1. Prepare an exact intent from canonical observations and owner review that this is an exclusive,
   disposable native branch alias, with no custom/shared use. The intent has `scope` (copy the fixed object from the manifest),
   `disposable: "exclusive-pr-preview"`, `prNumber`, `branch`, `prHead`, `deploymentId`, `commit`,
   and `aliases: [{ "id": "<observed UID>", "hostname": "<complete observed hostname>" }]`.
   Do not substitute a generated-looking URL or a suffix wildcard for observed identity.
2. Run `node scripts/preview-register.mjs --capture /tmp/ownership-intent.json` from reviewed
   code, with management-read access and `GITHUB_SHA` naming that code. It returns a
   `proposal-only` record and changes nothing. Capture is not an exclusivity attestation.
3. Put approved exact intents in
   [`preview-ownership-adoptions.json`](../scripts/preview-ownership-adoptions.json) through
   review and the normal default-branch release process. The committed list is currently empty.
   Old previews cannot be adopted just by supplying a runtime deployment ID.
4. Once the disabled intake workflow is installed and approved, its scheduled or manual run
   consumes those exact intents, rechecks canonical state and publishes an immutable Actions receipt.
   No manual manifest publication is needed per adopted deployment. The standalone `--adopt`
   command remains a candidate-only diagnostic; it is not the automatic workflow.
5. Cleanup consumes only authenticated receipts and the committed manifest, with ownership
   consumption and destructive execution independently gated. No restored preview was adopted.

### Automatic native completion and receipt publication

[preview-ownership.yml](../.github/workflows/preview-ownership.yml) implements the automatic loop.
It receives native `repository_dispatch: vercel.deployment.success` events on default master,
reconciles hourly and supports manual reconciliation. `preview-intake.mjs` requires the exact
approved default SHA and an observed, configured immutable Vercel bot sender ID for completion
signals. Event URLs and disposal claims are never used; the job re-fetches canonical GitHub,
Vercel, alias/domain and native Neon state. Fork/protected/shared/reused PR checks precede
provider capture. The workflow executes no PR checkout, dependency installation or PR code.

The owner must separately approve `prospectiveNativeAliasesExclusive=true`,
`trustedProvisioningClaimsEnabled=true` and `ownershipProvisioningAfter`. This is an explicit
prospective disposal policy for eligible native preview aliases in this fixed project. It is
an owner assertion of exclusive use, not something inferred from a hostname or Vercel event.
All exact identity, custom/shared/project/author-domain, microfrontend and project-target
exclusions still apply. Prospective capture permits at most the complete unshortened native
branch alias and rejects colliding normalized PR refs; shortened, unusual or additional aliases
require explicit reviewed adoption. This restriction is not disposal authority by itself.
Earlier deployments require exact reviewed adoption; missing/ambiguous
provider evidence remains blocked. Alias-free captures preserve native IDs too.

The producer uses pinned `actions/upload-artifact` to publish a single bounded `ownership.json`
snapshot under `preview-ownership-<run-id>-<attempt>`, with overwrite disabled and 14-day
artifact retention. A receipt grants authority only after its producer attempt succeeds.
No Git contents-write permission, data branch, custom webhook service or signing secret is used.
Provider calls from intake are read-only. The job-scoped artifact credential supplies publication
access; `GITHUB_TOKEN` needs `contents:read`, `pull-requests:read` and `actions:read`.

The consumer verifies the fixed repository, workflow path/ID, default branch, approved producer
SHA, exact successful run attempt, event/actor, artifact ID/digest, bounded single-file ZIP and
strict receipt/ownership schema.
Each successful producer publishes a complete snapshot retaining prior trusted records; consumers
use the newest verified snapshot, avoiding download of hundreds of redundant archives per plan.
They never fall back to an older snapshot after validation of a trusted snapshot fails.
The consumer never extracts or executes artifact contents. Signed download
URLs come only from authenticated GitHub responses, use approved HTTPS storage hosts and receive
no GitHub/provider token. Unknown PR artifacts confer no authority. Malformed trusted receipts,
incomplete pagination, ownership conflicts or failed reads block cleanup.

Receipts expire after seven days. Hourly reconciliation republishes only still-valid trusted
records plus newly verified captures; it preserves immutable native IDs after deployments vanish.
Expired receipts cannot be renewed from expired data. Existing eligible resources can be freshly
captured; otherwise explicit recovery/adoption is required. Both workflows share non-cancelling
concurrency; hourly inventory recovers completion events displaced from the pending queue.
Duplicate/out-of-order completion is idempotent. A changed PR or failure rolls back that PR's
new captures, while unrelated verified PR records may still publish with a sanitized journal.

The bounded inventory supports up to 2,000 repository artifacts and 2,000 ownership records,
with 4 MiB archive/JSON limits. Limits block rather than truncate; operators must review retention
or retired metadata when approaching them. A workflow outage exceeding receipt validity may
require explicit recovery of missing immutable IDs. Artifacts are data transport, not a guarantee
of perpetual historical storage or quota reclamation.

### One-time setup and recurring approvals

No settings below were applied by this draft:

- Install cleanup-only code/workflows/tests/docs on empty master using an explicit file allowlist;
  do not merge the entire develop feature history. Review production-trigger handling first:
  even an operations-only master push can trigger Vercel. Develop merging alone is insufficient.
- Approve the prospective disposal policy/cutoff, observed Vercel sender ID, native project/org/source
  mapping, exclusive integration use and settling/quiescence policy. Review exact older-preview
  adoption intents separately. Set the committed gates only through reviewed code.
- Configure a `preview-ownership` environment restricted explicitly to master, with read-only
  `LUNIA_VERCEL_REGISTRATION_READ_TOKEN` and `LUNIA_NEON_CLEANUP_READ_TOKEN`. Cleanup uses the
  separately protected `preview-cleanup` environment and its deployment-delete token. Actual
  provider token scopes require acceptance; no least-privilege capability is assumed available.
- Repository variables `LUNIA_PREVIEW_OWNERSHIP_ENABLED=true` and
  `LUNIA_PREVIEW_CLEANUP_PLANNING_ENABLED=true` admit jobs. They must be available before job start.
  Both environments need `LUNIA_PREVIEW_RECEIPT_APPROVED_SHAS`, a comma-separated allowlist of up
  to 20 reviewed producer/registration SHAs. Registration additionally requires its current
  `LUNIA_PREVIEW_REGISTRATION_APPROVED_SHA`; apply requires `LUNIA_PREVIEW_CLEANUP_APPROVED_SHA`.
  Update approvals for code changes; receipt publication creates no master commits or new SHA.
- Start with cleanup mode `plan`. Separately approve any destructive `apply` activation. Required
  environment reviewers pause every job, including schedules: retaining that policy deliberately
  retains human approval of deletion. Removing/replacing it to allow unattended execution is a
  separate security decision, not missing controller code. Registration reviewers similarly
  determine whether receipt production itself can run without per-job approval.
- Cleanup requires the PR's Git head branch to be absent. Manual removal or a separately approved
  repository branch-deletion policy remains necessary; the controller never deletes refs.

After installation and approved registration policy, new eligible previews need no per-preview
manual manifest publication. Routine human work is code-revision approval, explicit historical or
ambiguous-resource decisions, and destructive-run approvals required by the chosen environment
policy. The default 24-hour settling window and hourly reconciliation remain. This is implemented
and disabled code, not a claim of unattended live operation or provider acceptance.

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
arbitrary artifact download or cache restoration occurs (`package-manager-cache: false` is explicit).
Fork close events are skipped before the secret step; canonical fork checks precede Vercel
reads for manually selected PRs. No merge/default-branch/repository-permission change is made.

## Provider evidence and remaining acceptance

[Vercel exact-ID deletion](https://vercel.com/docs/rest-api/deployments/delete-a-deployment),
[complete deployment aliases](https://vercel.com/docs/rest-api/aliases/list-deployment-aliases),
and [Neon branch inventory](https://api-docs.neon.tech/reference/listprojectbranches) plus
[immutable branch lookup](https://api-docs.neon.tech/reference/getprojectbranch) define the
adapters. Neon's [official cleanup guide source](https://github.com/neondatabase/website/blob/main/content/docs/guides/vercel-branch-cleanup.md)
confirms last-deployment cleanup. Its table lists Hobby preview retention as 30 days, with
exceptions for recent deployments and custom aliases; a retained deployment can keep a
branch indefinitely. Provider docs were checked on 2026-10-08; no retention setting changed.

All restored previews and PR45 are preserved. The previously reported spare slot is not a
current quota claim. Full local checks and exact-head CI belong to the draft's verification
record. Live permission checks, actual deletion/native cleanup, live receipt publication/alias acceptance, operational
quiescence and owner activation remain unverified and unapproved.
