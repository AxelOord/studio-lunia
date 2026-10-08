# Preview cleanup — requirements

Workflow: requirements-first
Status: ready

## Goal and scope

Related: [issue #46](https://github.com/AxelOord/studio-lunia/issues/46).
Prepare a reviewable closed/merged PR preview cleanup controller, initially disabled.
Native Neon cleanup depends on removing the branch's last Vercel deployment. Preserve
all existing previews during this work. No direct Neon, Blob, Git branch, production,
credential, permission, billing or repository-setting mutations are in scope.

### R-1: Exact ownership and protected resources

WHEN planning cleanup, the system SHALL verify the fixed repository ID/name, Vercel
team/project/link, current closed PR, full head ref and complete deployment inventory.
It SHALL refuse forks, missing/contradictory ownership, production/custom targets,
protected refs (main/master/develop/hosted-cms-preview), open/shared branches and any
remaining Git branch. Each deployment must belong to that sole PR's commit history;
an explicit different PR ID is a blocker. Immutable repository provenance is required.
Assigned aliases and current project targets SHALL block deletion. Names or prefixes alone are insufficient.
Check: owned synthetic API inventories and negative ownership/protection cases.

### R-2: Disabled execution and trusted workflow

WHEN invoked normally, the system SHALL emit a read-only plan. Real deletion SHALL
remain disabled by committed activation policy, require an approved exact workflow SHA,
and use the supported exact-ID Vercel DELETE adapter after separate owner setup. The optional
workflow SHALL run reviewed default-branch code only, never PR code, and remain gated
until separately approved management access/setup. Forks SHALL receive no provider access.
Check: subprocess/HTTP-boundary and workflow-contract tests; no provider mutation.

### R-3: Repeatable execution and races

WHEN executing cleanup, the controller SHALL revalidate PR/project/branch ownership
and the complete inventory before every deletion, reject new/reassigned deployments,
reopening or branch reuse, tolerate already absent deployments, and stop on uncertainty.
Only initial exact deployment IDs may be removed. An overlapping local run SHALL be
rejected and workflow runs SHALL share one non-cancelling concurrency group.
Check: race injection, repeated runs, lost responses, duplicate execution and late deployment tests.

### R-4: Partial failure and honest completion

WHEN any provider read/write fails, the controller SHALL retain a sanitized progress
journal and stop, without broadening the target, forcing deletion or retrying writes.
A fresh plan can resume remaining exact resources. Empty Vercel inventory SHALL NOT
be reported as proof of Neon deletion. Pagination and malformed responses fail closed.
A read-only Neon inventory SHALL verify the configured project and exact native branch;
retained/unknown database state SHALL remain distinguishable from absence.
Check: fake transport failures, pagination boundaries and outcome reporting.

### R-5: Operational handover and preservation

WHEN publishing the draft, the documentation SHALL explain native cleanup, remaining
management access/approval, default-master versus develop triggers, residual cross-provider
race limits, retention and manual reconciliation. Existing checks SHALL remain intact.
Hourly reconciliation SHALL revisit all eligible closed PRs after an approved cutoff,
including events displaced from the concurrency queue, delayed branch removal and builds.
Check: full npm run verify, exact-head CI and review of the separate draft.

## Open questions

Activation requires owner review of retention/data loss, protected-environment setup,
management access and provider acceptance. No setup is performed here. GitHub/Vercel
provide no atomic check-and-delete across PR state, refs and deployment inventory;
live activation needs an approved quiescence policy. Native Neon release must be
observed separately, without deleting its branches or shared media as a fallback.
