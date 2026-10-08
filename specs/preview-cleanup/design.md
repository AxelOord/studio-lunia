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
are checked. Aliases require exact trusted ownership records and fresh routing/domain checks;
unregistered or ambiguous aliases remain protected. No API ever deletes a database or Blob object.
Microfrontend exclusions belong to unconditional project/deployment identity validation.
Reproduction: an otherwise eligible alias-free deployment with project or deployment
microfrontend routing must block the whole branch before any deletion, including after
partial progress. Alias observation is not a prerequisite for this protection.

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
reports unverified. The only cross-run identity source is the reviewed ownership manifest;
untrusted run artifacts are never accepted. No direct Neon mutation exists.

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
R-6: fixed reviewed manifest, gated registrar, explicit adoption/provisioning claim contracts,
fresh alias/domain reads and atomic local compare-and-swap publication preparation.
R-7: default-code receiver, prospective owner policy, immutable artifact publication,
authenticated receipt consumption and hourly renewal/reconciliation.

## Ownership registration contract

Keep committed adoption data and authenticated Actions receipts, without a new service.
The empty committed manifest grants no authority. A read-only capture produces a proposal;
review/publication or an approved producer makes it consumable. Existing previews
use committed exact adoption intents. A separately enabled trusted provisioning caller can
supply an explicit exclusive alias binding after completion; the native Vercel event does
not itself prove that intent. The new disabled intake workflow supplies that claim only under
the prospective owner policy below. No account change is applied. The standalone registrar
writes only a separate private temporary manifest candidate under a lock with an
expected-content check and atomic rename; it never publishes Git or changes provider resources.
The existing exact-default-SHA approval still applies after manifest publication.

Records bind PR creation identity/full ref, deployment ID/commit/time, alias UID/hostname/
creation/update observations and optional native branch ID. They are immutable per deployment.
The same branch alias can have successive explicitly registered deployment associations for
the same sole PR. Conflicting owners, recreated alias IDs or mutated records fail closed.
Cleanup admits only currently assigned exact tuples, excludes all configured project domains,
redirects, microfrontends and project targets, and rechecks before every DELETE. A removed alias
does not make an otherwise alias-free old deployment unsafe. No hostname pattern establishes
ownership. Captured native IDs in the trusted manifest permit later read-only verification;
conflicting native identities remain a blocker. Without a trusted ID, absence stays unverified.

## Automatic receipt boundary

The gated preview-ownership workflow runs default master code for native Vercel success
repository_dispatch, hourly reconciliation or explicit operator dispatch. A configured immutable
Vercel sender ID authenticates the wake-up; canonical provider reads supply identities. The owner
must explicitly approve prospective exclusive native preview alias use in this fixed project and
a cutoff. That policy supplies disposal intent, not event metadata or a hostname pattern. Exact
reviewed adoptions remain the only path for earlier deployments. Prospective alias capture is
additionally limited to the complete unshortened native branch slot, with collision checks
against normalized refs in the full PR inventory. Unusual/shortened/additional aliases need
explicit adoption; pattern matching is a negative ambiguity guard, never disposal authority.

The producer publishes one bounded ownership.json snapshot with pinned upload-artifact, only
after all required receipts and provider reads succeed. Both workflows share non-cancelling
concurrency. A successful run, its exact workflow path/ID, master ref, repository IDs, approved
producer SHA, run attempt, receipt lifetime and archive digest authenticate consumption. Approved
producer SHAs are a separately configured allowlist so code updates can preserve explicitly
approved older receipts without giving PR artifacts authority. A new consumer validates a single
bounded JSON entry in the archive without extracting files or executing data. Artifact storage is
the existing GitHub Actions service; no Git publisher or new service exists.

Hourly snapshots renew still-valid historical receipts, preserving immutable Neon IDs even after
deployments disappear. Expired receipts are not revived; currently eligible resources must be
recaptured from canonical state, or explicitly adopted. Existing committed records stay valid.
Missing provenance, failed publication, incomplete pagination and conflicting records fail closed.
Only a successful producer run confers authority, so a failed upload/job cannot partly publish.
Metadata archives have bounded size/count and retention; reaching a bound blocks instead of
silently truncating history. This does not eliminate cross-provider read/write races.

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
