# Preview cleanup — design

## Approach and boundaries

A dependency-free Node controller is separate from the application and uses a small
GitHub/Vercel adapter. Fixed non-secret IDs identify the sole repository/team/project.
Plan from fresh canonical API data, never a webhook's mutable branch metadata or a
saved plan supplied by an operator. Missing ownership is a blocker, not a wildcard.
Require a closed same-repository PR targeting develop, a deleted Git head ref, no other
PR ever using that head, no open PR using it as a base, and terminal deployments created
no later than closure. Retaining the Git ref retains the preview. A manual plan can be
requested after branch deletion; closure by itself does not imply data-loss approval.

Read all PRs/deployments using bounded, checked pagination. The one PR's commits prove
membership for native push deployments that lack githubPrId. If present, that metadata
must match. A full 250-commit GitHub result is refused because that API caps the history.
An unrelated, production, ambiguous or active deployment on the exact branch blocks
the entire plan, including the final native cleanup trigger. Never trim a name, normalize
a slash or guess a Neon branch name. Project targets and complete alias inventories
are checked; any assigned alias blocks, since its disposability is not established. No API ever deletes a database or Blob object.

Execution takes only a freshly made plan and repeatedly rebuilds it before each exact-ID
mutation. Remaining inventory may shrink after another actor deletes a deployment; it
may never gain or change a member. Recheck after each response and at completion. A
sanitized journal records successful/absent IDs and failure phase, without provider bodies,
URLs, raw errors or secrets. A lost write response stops; the next run inventories actual
state. A local exclusive file lock and global Actions concurrency prevent our overlapping
runs. They cannot lock outside actors or Vercel's independent Git deploy pipeline.

The production adapter implements exact-ID Vercel DELETE, gated by a committed policy
(executionEnabled=false), apply mode, a protected-environment approval for the exact
workflow SHA, and reviewed native project/organization/source-branch IDs. No live calls
are used for tests. Native Neon inventory is GET-only: match the documented full
preview/<git-branch> name inside that configured project, reject protected/default/root
or parent branches, and preserve its immutable ID through execution. Missing or retained
Neon resources never authorize a broader deletion. Post-delete Neon absence is observed
separately by GET of the captured immutable ID; a rename cannot establish deletion.
Reproduction: after the final Vercel DELETE, retain the same Neon ID under a different
name. The expected outcome is retained, never cleanup-verified. A later stateless run
cannot prove a missing name represents deletion; without the original captured ID it
reports unverified. This implementation does not accept identity from untrusted run
artifacts or add persistent state. No direct Neon mutation exists.

An approved closure cutoff and minimum closed age exclude historical previews and provide
a settling window. Hourly reconciliation inventories all PRs before mutations, prefilters
closed same-repository develop PRs, and freshly plans each. Protected/retained branches
remain blocked and are revisited later. Transient failures stop the batch with its journal;
a new scheduled run reconciles actual state. This catches displaced pending Actions events,
branch deletion after closure and terminal build transitions without trusting stale plans.
The deleted Git-ref requirement remains; the controller never deletes Git refs itself.

## Behavior mapping

R-1: fresh ownership guards, complete inventory and exact commit/ref/PR checks.
R-2: default-off policy, exact-SHA approval, supported gated adapter, gated workflow with reviewed default SHA checkout.
R-3: per-delete replan, immutable identity comparison, exclusive lock and Actions concurrency.
R-4: sanitized progress result, bounded pagination, fake HTTP and failure/retry cases.
R-5: runbook, preserved aggregate suite and exact-head draft evidence.

## Tradeoffs and verification

A direct Neon API fallback could delete a database still used by another deployment;
therefore only the native Vercel lifecycle is used. Ambiguous historical deployments
need explicit operator reconciliation, not an automatic broader sweep. Neon may retain
branches under provider rules or delayed actions even after Vercel inventory reaches zero.
Shared preview Blob data is deliberately retained for a separate retention decision.

Checks immediately before deletion reduce races but cannot atomically prevent a reopen,
promotion or new deploy between the last read and Vercel DELETE. This is a material live
activation blocker. The committed disabled policy prevents real deletion in this
PR; concurrency tests establish controller behavior, not a cross-provider transaction.
