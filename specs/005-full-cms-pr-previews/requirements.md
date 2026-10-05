# Full CMS automatic PR previews

Workflow: requirements-first
Status: ready

Native automatic previews are the recommended first implementation. See
`docs/full-cms-preview-decision.md` for access tradeoffs and pending handoff.

### R-1: Entire site works

Trusted previews support editor login, uploads, draft preview, publication, approved
reset mail and persistent branch content across commits. Showcase is not completion.
Check: hosted browser flow, real image bytes, reset and rebuild persistence.

### R-2: Preview-only resources

Use native Neon database branches from a verified synthetic parent and private preview
media with branch namespaces. Disclose native owner-role runtime access and shared Blob
capability; accept them only for trusted synthetic previews. Old site/production remain
untouched. Forks receive no preview secrets.
Check: provider scope metadata, two-branch app access tests and fork-negative checks.

### R-3: Ordinary automatic lifecycle

Git previews migrate before building, serialize schema changes, initialize only once and
fail visibly on errors. Preserve editor data and current provider retention. Review
incompatible schema changes and confirm superseded-build behavior.
Check: concurrent updates, failed migration, idempotent rebuild and branch reuse.

### R-4: Explicit access and existing free limits

Confirm native Preview-only connection, trusted-preview shared capabilities and private
editor bootstrap before activation. Keep existing Free plan and retention; no invented
PR caps, new management keys, paid upgrades or secret output.
Check: recorded decision, safe source/role verification and actual account limits.
