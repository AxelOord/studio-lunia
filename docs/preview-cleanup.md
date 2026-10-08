# Closed PR preview cleanup (activation disabled)

Related: [issue #46](https://github.com/AxelOord/studio-lunia/issues/46),
[draft PR #47](https://github.com/AxelOord/studio-lunia/pull/47) and
[specification](../specs/preview-cleanup/requirements.md).

The controller implements planning, exact-ID Vercel deletion, scheduled reconciliation and
read-only native Neon observation. **Destructive execution remains disabled.** The committed
[activation policy](../scripts/preview-cleanup-policy.json) has `executionEnabled=false`,
no closure cutoff and no native project IDs. Ownership registration, consumption and trusted-provisioning claims are also disabled; the manifest and adoption-intent list are empty. Neither an apply flag nor variables can bypass
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
never consumes prior logs or arbitrary artifacts as deletion authority. Absence is not a claim
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
the same reviewed checkout as cleanup code. No runtime manifest path, PR file, downloaded artifact
or webhook payload grants authority. `ownershipConsumptionEnabled=false` keeps this path disabled.
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
4. After separately enabling `ownershipRegistrationEnabled` in reviewed code, a trusted default
   runner with `LUNIA_PREVIEW_REGISTRATION_APPROVED_SHA` equal to `GITHUB_SHA` may run
   `node scripts/preview-register.mjs --adopt <exact-deployment-id>`. It selects only the reviewed
   intent, rechecks canonical state and writes a private temporary manifest candidate, separate
   from the committed manifest consumed by cleanup. It returns `candidatePath` and `published:false`;
   running cleanup in that same job cannot consume the candidate. Conflicting existing
   records are immutable; repeat capture is idempotent. A lock, expected-snapshot comparison and
   atomic rename prevent lost updates and partial JSON. No stale lock is stolen.
5. Review/publish that manifest through the existing default-branch process. It becomes usable
   only when ownership consumption and the original cleanup activation gates are approved.
   Every new default SHA still needs exact-SHA cleanup approval. No publication automation or
   bypass of that gate is included. Once the record is installed, ordinary close/reconciliation
   events can remove its eligible deployment and observe native cleanup automatically.

### Trusted completion contract and minimal native Vercel hookup

A trusted provisioning host may call `registerOwnership(...)` or
`node scripts/preview-register.mjs --completion <trusted-intent-file>` after deployment completion.
This additionally requires `trustedProvisioningClaimsEnabled=true` and an owner-reviewed
`ownershipProvisioningAfter` cutoff; older deployments still require reviewed adoption.
It must authenticate the
completion signal, run reviewed default code independently of the PR build, and supply its own
explicit exact exclusive/disposable alias binding. It then publishes the local manifest candidate
through the same reviewed process. No listener, signing key, new storage service, data branch,
workflow, auto-publisher or account setting is installed by this PR.

The precise native-Vercel boundary is the _disposable/exclusive intent_, not the ability to read
alias identity. A native completion event or API response alone does not provide that intent.
The [Get Alias contract](https://vercel.com/docs/rest-api/aliases/get-an-alias) provides UID and
current routing. The official SDK's [deployment response](https://github.com/vercel/sdk/blob/a35c06b4644dc56ce956f66da06a41d50ee5a791/src/models/getdeploymentresponsebody.ts)
provides optional automaticAliases/userAliases, without an exclusive full-ref ownership contract.
The [generated URL documentation](https://vercel.com/docs/deployments/generated-urls) includes
shared names and shortening, so deriving the binding from a pattern remains unsupported.

The smallest safe hookup to the existing native integration is therefore: completion identifies
an exact deployment; a trusted read-only capture prepares its tuple; owner-reviewed adoption
supplies the missing exclusivity intent; the registrar records it; cleanup consumes the published
record. Fully unattended registration requires a provisioning host that actually owns that
binding and the existing approval/publication process to be operational. Blindly forwarding
native webhook or PR fields into the trusted-completion API does not meet this contract.
The exact adoption path is implemented now; no real preview has been adopted or removed.

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
and [Neon branch inventory](https://api-docs.neon.tech/reference/listprojectbranches) plus
[immutable branch lookup](https://api-docs.neon.tech/reference/getprojectbranch) define the
adapters. Neon's [official cleanup guide source](https://github.com/neondatabase/website/blob/main/content/docs/guides/vercel-branch-cleanup.md)
confirms last-deployment cleanup. Its table lists Hobby preview retention as 30 days, with
exceptions for recent deployments and custom aliases; a retained deployment can keep a
branch indefinitely. Provider docs were checked on 2026-10-08; no retention setting changed.

All restored previews and PR45 are preserved. The previously reported spare slot is not a
current quota claim. Full local checks and exact-head CI belong to the draft's verification
record. Live permission checks, actual deletion/native cleanup, registry publication/alias acceptance, operational
quiescence and owner activation remain unverified and unapproved.
