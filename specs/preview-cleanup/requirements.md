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
Current project targets SHALL block deletion. Assigned aliases SHALL require an explicit
trusted disposable-preview ownership record plus fresh exact-ID/hostname/project/deployment
validation and complete project-domain exclusion. Names or prefixes alone are insufficient.
Unregistered, custom, shared, reassigned, redirected, recreated or ambiguous aliases SHALL
remain protected. Optional automaticAliases metadata SHALL NOT authorize disposal.
Project/deployment microfrontend protection SHALL apply even when a deployment has no aliases.
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
Absence SHALL be verified by the immutable branch ID captured in that execution or a trusted manifest, not
by a missing name. A rename SHALL remain retained; a later run without a trusted
captured identity SHALL report unverified even if the expected name is missing.
Check: fake transport failures, pagination boundaries and outcome reporting.

### R-5: Operational handover and preservation

WHEN publishing the draft, the documentation SHALL explain native cleanup, remaining
management access/approval, default-master versus develop triggers, residual cross-provider
race limits, retention and manual reconciliation. Existing checks SHALL remain intact.
Hourly reconciliation SHALL revisit all eligible closed PRs after an approved cutoff,
including events displaced from the concurrency queue, delayed branch removal and builds.
Check: full npm run verify, exact-head CI and review of the separate draft.

### R-6: Trusted registration and reviewed adoption

WHEN registering disposable preview ownership, the registrar SHALL capture exact repository,
project, PR/full ref, deployment, alias UID/hostname and available native branch identity from
fresh canonical provider reads. Registration SHALL require a trusted explicit exclusivity claim;
an ordinary native deployment event or generated-looking URL alone is insufficient.
Existing previews SHALL use explicitly reviewed adoption intents; trusted-completion records
SHALL be limited to deployments after an approved provisioning cutoff. Reviewed default-branch
data and authenticated receipts from approved default-branch code are the consumption trust boundary;
runtime paths, PR files and arbitrary artifacts SHALL NOT supply cleanup authority.
Registration/publication remains disabled pending setup.
Local manifest updates SHALL be atomic, compare the prior snapshot and preserve other records.
Check: registration-to-cleanup fake-provider journeys, immutable binding/conflict/schema tests,
stale snapshots/concurrent writers, disabled gates and exact adoption/provisioning contracts.

### R-7: Automatic trusted intake and receipt publication

WHEN enabled by reviewed prospective disposal policy, a default-branch receiver SHALL authenticate
native Vercel success dispatches, re-fetch canonical provenance and register exact eligible tuples.
It SHALL publish immutable Actions receipts without Git writes or executing PR code. Consumption
SHALL verify repository, producer workflow, approved code SHA, successful run/attempt, digest,
schema and expiry. Untrusted producers never confer authority; malformed trusted receipts block.
Hourly reconciliation SHALL recover missed, duplicated or out-of-order completion events, adopt
only exact reviewed older tuples and renew verified receipts before expiry. Expired/missing
receipts SHALL never establish alias or native identity. Publication failure SHALL not authorize
cleanup. Declared Actions read/artifact-upload permissions are reviewable code only; activation,
provider credentials, prospective policy and destructive-run approval remain separate decisions.
Check: fake Actions/Vercel/Neon end-to-end intake-publication-consumption; sender, provenance,
pagination, tampering, expiry, renewal, concurrency, reopen and partial-failure adversarial tests.

## Open questions

Activation requires owner review of retention/data loss, protected-environment setup,
management access and provider acceptance. No setup is performed here. GitHub/Vercel
provide no atomic check-and-delete across PR state, refs and deployment inventory;
live activation needs an approved quiescence policy. Native Neon release must be
observed separately, without deleting its branches or shared media as a fallback.
