# Closed PR preview cleanup (disabled)

Related: [issue #46](https://github.com/AxelOord/studio-lunia/issues/46) and
[requirements/design/tasks](../specs/preview-cleanup/requirements.md).

This controller prepares read-only plans for the separate Studio Lunia project. **It cannot
delete real resources.** `--apply` is rejected before network access and the production API
adapter has no DELETE request. A token, repository variable or manual workflow input cannot
remove that source-code block. Tests simulate the eventual sequence using owned fake resources.
All five restored previews are preserved; the operator reported one spare Neon slot when
this work was authorized on 2026-10-08. No current quota count is inferred from local tests.

## What can be planned

The fixed scope is repository `AxelOord/studio-lunia` (ID `1404604205`), Vercel project
`prj_RiVoPaLLyHgqAwR2Hivx3X2hRTAM`, team `team_x4WNnHtFU7Uuf4bAgWyWXRLR`.
The canonical project link must agree with that GitHub repository and production branch.
Only a currently closed or merged, same-repository PR into `develop` can qualify.

The full Git head ref must already be absent. A retained branch deliberately retains its
preview, even after its PR closes. `main`, `master`, `develop`, `hosted-cms-preview` and
refs containing those path segments, plus `release/` and `shared/` refs, are protected.
Another PR ever using the head, an open PR based on it, a fork, a missing repository or
incomplete inventory blocks planning. Reused names are not silently treated as old work.

Every deployment on the exact branch must have the correct project and native Git metadata,
a null preview target, a terminal state and a creation time no later than PR closure.
Its commit must be in the sole PR's canonical commit list, including the head. Optional
`githubPrId` must agree; push deployments without that field can qualify through sole-PR,
repository, branch and commit provenance. Missing/contradictory metadata, historical commits
outside that PR, CLI recreations, active builds and production/custom environments block the
whole plan. A 250-commit PR is refused because GitHub caps that endpoint. This deliberately
favours retaining ambiguous resources over guessing how to recover the last slot.

The controller never guesses a Neon branch name or deletes a Git branch, database, media
namespace, Blob store, project or alias. It never uses a user URL as a deletion target.

## Native cleanup and failure handling

The operator's native integration investigation established that Neon cleanup requires the
last Vercel deployment using the preview branch to be deleted. PR closure is not that deletion.
The simulated controller removes all verified deployment IDs oldest first, including the last;
it does not remove only the newest deployment and call the database reclaimed. No native
provider deletion was exercised by this implementation.

Before each simulated deletion it replans from current canonical state. An inventory may shrink
because another actor removed an ID, but may not acquire a new or changed member. Reopening,
branch recreation, shared use, promotion or project reassignment stops further work. A write
failure or lost response stops without a write retry and preserves a sanitized progress journal.
Rerunning starts a new inventory and handles already absent IDs. Final inventory must be empty;
that proves only Vercel deployment absence. Native Neon cleanup can be delayed or retained by
provider rules and requires separate read-only observation. If it does not happen, report the
remaining branch; never directly delete Neon or shared Blob data as a fallback.

An exclusive local lock and one non-cancelling Actions concurrency group prevent overlapping
controller runs. If a local process crashes, verify it is stopped before manually removing its
`studio-lunia-preview-cleanup.lock` in the system temporary directory. The controller never
steals a stale lock or broadens its scope to recover from a failure.

GitHub PR/ref reads and Vercel DELETE do **not** form an atomic transaction. A reopen, promotion
or new Git deployment can occur after the last read. Our concurrency group cannot lock users,
other workflows or Vercel's native Git pipeline. A reviewed quiescence/retention policy and
provider acceptance are required before any live adapter is introduced. The hard-disabled live
boundary is the safety guarantee in this PR; tests do not claim to eliminate cross-provider races.

## Management access and activation prerequisites

No new credentials or settings are configured by this work. Future read-only planning needs:

- GitHub repository metadata, contents/refs and pull requests **read** access. The workflow uses
  its read-only `GITHUB_TOKEN`; it has no issue, repository or permission write actions.
- A narrowly scoped Vercel management capability able to read the exact project's link and
  deployment metadata/inventory. `LUNIA_VERCEL_CLEANUP_TOKEN` is only a future protected-environment
  secret name; no value has been retrieved, created or installed. Runtime database, Blob, Resend
  and application signing credentials are neither needed nor suitable for this management task.
- A separately approved `preview-cleanup` environment restricted to reviewed `master` code and
  required reviewers, then `LUNIA_PREVIEW_CLEANUP_PLANNING_ENABLED=true` if planning is desired.
  Neither the environment nor the variable is created here. Keep provider credentials out of
  install steps, fork/PR code, artifacts, shell arguments and repository files.

Actual execution would additionally need explicit owner approval of synthetic preview data loss,
retention/quiescence, appropriate Vercel deployment-delete management permission and a reviewed
source change adding the currently absent live DELETE adapter. The native Neon integration's
existing lifecycle access should perform its cleanup; no Neon management key is required here.
Do not assume a Vercel team token is project-isolated: validate the provider's available scopes
and reviewer policy before granting it. No credential, security, billing or production changes
are authorized by this draft.

After setup is separately approved, a reviewed local checkout can print a plan with
`npm run preview:cleanup -- --pr 91` (replace 91 with the intended closed PR number), using
securely supplied environment credentials. No environment-file loader is included.
`npm run test:cleanup` needs no management access and makes no external request.

## Default branch and workflow triggers

The remote default remains **master** at `3397973f90bb39e6f143e2982edb94262d677540`;
this feature branches from **develop** at `5f1669e8bb490b64e2bd5ee74a63878bea5f67fc`.
Merging this draft into develop alone does not install the lifecycle workflow on master.
Under the current [GitHub event contract](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request_target),
`pull_request_target` uses default-branch code; the `branches: [develop]` filter selects PR
bases, not the code to execute. `workflow_dispatch` also requires the workflow on the default
branch. This workflow additionally rejects any ref other than `refs/heads/master`, including
manual dispatches against feature/develop refs, and checks out the event's exact default SHA.
It never checks out a PR head/merge commit, installs dependencies or downloads artifacts.
Fork lifecycle events are skipped before the provider secret step; manual fork selection is
rejected using canonical GitHub data before any Vercel call.

Once an owner-reviewed release includes the workflow on master and planning is separately
configured, a close/merge event can request a plan. If the Git ref still exists at that point,
the plan blocks; an operator can manually request a new plan after owner branch deletion.
There is no scheduled catch-up, automatic branch deletion or hidden live switch. Owner decisions
about the master release/default branch remain separate; this task changes neither and merges
nothing. Existing Foundation CI still validates this draft normally via `pull_request`.

## Sources and verification limits

Vercel documents the [project/branch-filtered deployment inventory](https://vercel.com/docs/rest-api/deployments/list-deployments),
[deployment detail and null preview target](https://vercel.com/docs/rest-api/deployments/get-a-deployment-by-id-or-url),
and [exact-ID deletion endpoint](https://vercel.com/docs/rest-api/deployments/delete-a-deployment).
The code omits state/target inventory filters so unsafe peers cannot disappear from planning.
Provider schemas/documentation were inspected on 2026-10-08. The native Neon lifecycle statement
above comes from the delegated operator investigation; the Neon documentation endpoint returned
an unsupported content type during this coding task, so it is not presented as independently
revalidated provider evidence.

The tests cover policy, fake HTTP contract, pagination, event/fork/checkout boundaries, lock
contention, retries, races and sanitized partial outcomes. Full repository verification and
exact-head CI are recorded in the draft PR. No application interface is changed; existing
browser journeys remain the application regression gate. Hosted cleanup acceptance, real
management permissions and automatic Neon slot reclamation remain unverified.
