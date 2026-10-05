# Full CMS automatic PR previews

Workflow: requirements-first
Status: ready

The user requires working CMS functionality on every trusted PR deployment. Showcase is
interim only and does not satisfy acceptance. Activation awaits the explicit resource,
credential, lifecycle and budget handoff in docs/full-cms-preview-decision.md.

### R-1: Entire site works

Each accepted preview supports approved editor login, upload, draft preview, publication,
real allowlisted reset mail and persistent PR content across commits.
Check: real hosted browser flow, image bytes, reset lifecycle and redeploy persistence.

### R-2: Isolated resources and least privilege

Each PR has its own database and private media capability. Runtime cannot migrate schemas;
provider-management and migration credentials stay outside deployed functions and untrusted
PR scripts. Forks receive no privileged access. Production/old site remain untouched.
Check: two-PR access denial, role/grant tests, runtime environment metadata and fork-negative checks.

### R-3: Ordered automatic lifecycle

A trusted workflow serializes per-PR migration/deploy, checks exact current SHA, preserves
last working preview on failure, bootstraps once and cleans only owned closed-PR resources
after an approved retention period. No automatic deletion of active editor work.
Check: simultaneous updates, failed migration, stale completion, retries and cleanup dry run.

### R-4: Explicit access/cost decision

Approve resources, protected management credentials, preview runtime capabilities, editor
bootstrap and budget before provisioning. Record real account limits; stop instead of
upgrading or exceeding approved usage. No owner URL reuse or secret output.
Check: reviewed handoff and bounded disposable provider capability spike before activation.
