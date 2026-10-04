# Design

## Boundary and decisions before implementation

Foundation PR #1 is merged into develop; this spec branches from develop. Runtime remains
Payload 4.0.0-canary.37, PostgreSQL, Next.js and Node 24 until an explicit tested change.
Recommendations below are not provisioning approval. Record Axel's answers before T-2:

| Decision               | Proposed choice                                                                                                 | Approval needed                                                                              |
| ---------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Hosting/account/budget | Existing studio-lunia project; confirm team plan and agreed monthly ceiling/alerts                              | Owner, eligible plan, spending cap, whether any new accounts/services may be created         |
| Database/region        | Dedicated managed PostgreSQL preview database; Neon is a candidate, existing suitable service preferred         | Provider, EU region if available, account ownership, quota/restore window and credentials    |
| Media                  | Dedicated private object store; evaluate Vercel Blob private mode first, S3-compatible private storage fallback | Provider/region, backup destination, volume cap; exact canary adapter support must be proved |
| Preview isolation      | One named, trusted feature branch and stable branch alias; all other branches remain showcase                   | Branch name and permitted editors; no production or shared CI data                           |
| Recovery email         | Existing approved SMTP service if available; Resend is an alternative                                           | Sender identity, recipient allowlist, service/key; any DNS changes require separate approval |
| Recovery policy        | Synthetic data only, daily encrypted backup plus pre-migration snapshot; retain 7 days; target RPO 24h/RTO 4h   | Owner and retention/budget; these are targets to prove, not service guarantees               |

R-1, R-4: Replace the blanket hosted-CMS rejection with an explicit fail-closed mode check
for VERCEL_ENV=preview, expected project/branch and complete configuration. Preserve the
production rejection and showcase default. Scope secrets to the one approved branch;
never provide them to forks, arbitrary feature deployments or GitHub pull_request jobs.
Use separate least-privilege runtime DB access and operator migration credentials, TLS,
connection pooling and a region near the function. Select provider versions compatible
with the pinned database adapter. Build must not seed, migrate or require live data.

R-2: Keep storage private and route reads through Payload authorization; public media
means permission to read through the protected site, not an unprotected bucket URL.
Validate exact tagged adapter support before selecting it. If the canary Blob adapter
cannot enforce private derivatives, use a proven private S3-compatible adapter or retain
the gate; never weaken media access to make uploads work. Use opaque environment-scoped
keys, disable persistent local media, and verify original/derivative lifecycle together.
Set proposed initial caps of 20 MB and 40 megapixels per image. Vercel Function payload
limits make direct uploads a required design spike: scoped short-lived editor-authorized
upload tokens, quarantine then server validation/finalization, bounded derivative work,
no public metadata until success, cleanup of orphaned objects. If this cannot run within
function limits, reduce documented limits with Axel or propose a separate worker spec.
No raw/full-resolution delivery in page grids; retain responsive sizes, alt text and lazy
loading. Private reads use no-store; publication changes invalidate any authorized public
cache and are tested through the image optimizer as well as storage URLs.

R-3: Use Payload editor auth behind Vercel Authentication. Bootstrap from an authenticated
operator command with one-time secret input, explicit target confirmation and idempotence;
remove temporary bootstrap inputs afterward. Reuse Payload reset machinery with a pinned
compatible email adapter, approved origin and recipient allowlist. Rate-limit login/reset
and uploads with a strategy that works across function instances; confirm lockout limits
and recovery behavior. Session cookies must be secure; test CSRF/origin rejection. Disable
email open/link tracking. Test recovery with an approved mailbox; never log reset links.

R-4: Reuse draft authentication and slug validation. Verify published reads independently
from draft reads; no client flag grants draft access. Preserve noindex headers/metadata,
robots disallow and existing deployment protection. Noindex is not access control.

R-5: Do not run migrations automatically during every preview build. Use a serialized
operator runbook: verify target IDs, backup DB plus immutable media-key manifest, dry-run
on restored data, migrate, verify schema, then enable/deploy the reviewed commit. Prefer
additive migrations; failed changes keep the prior deployment available if compatible.
A code rollback does not undo schema changes. Restore to a new DB/store, compare counts,
relationships and content hashes, verify login/draft/media, then decide recovery explicitly.
Quiesce writes for consistent export; encrypt backups, limit access and test retention
cleanup. Per-PR databases are a later optimization; never share the writable preview with
CI fixtures or concurrently migrating branches.

R-6: Existing audit evidence is in docs/verification.md. Reassess before enabling /admin:
Monaco/DOMPurify and the canary patch have a different reachable surface than showcase.
Pin official adapters to the same canary when available; stop if compatibility cannot be
verified. Keep patch-package failure visible in clean CI; remove the font patch only when
the upstream fix is verified. Record advisory disposition and approver in the handover.

R-7: CI remains service-isolated and credential-free. Hosted acceptance is a separate
explicit operator test using approved editor access, with both authenticated and anonymous
Payload contexts behind the Vercel perimeter. Verify perimeter denial separately without
bypass. Redact credentials/tokens from screenshots and traces; do not publish those traces.
Record spend alerts (not assumed hard caps), failure handling, backup owner and teardown.
Keep old project/domain configuration read-only. No production credentials, domain binding,
booking or tracking is part of this spec.

## Cost and capacity notes — checked 2026-10-04

This is a planning estimate, not a quote or approval. Initial test envelope: one editor,
20 synthetic photos, at most 0.5 GB including derivatives, 1,000 media reads and 50 reset
emails/month. Backup copies, image transformations, compute and egress add usage.

- [Vercel Blob pricing](https://vercel.com/docs/vercel-blob/usage-and-pricing): Hobby lists
  1 GB storage, 10 GB transfer, 10,000 simple/2,000 advanced operations; paid listed base
  storage is $0.023/GB-month with operation/transfer charges. Private delivery also incurs
  function/CDN usage. The test envelope fits nominal storage limits, but derivatives and
  backups must be measured; region/team credits change incremental cost.
- [Vercel Hobby](https://vercel.com/docs/plans/hobby) is restricted to personal,
  non-commercial use. Do not assume this photographer project qualifies or that current
  team allowances are unused; verify existing paid plan before recommending any upgrade.
- [Resend pricing](https://resend.com/pricing): free transactional tier lists 3,000/month
  and 100/day; Pro lists $20/month for 50,000. The proposed reset volume fits free quotas,
  subject to sender/domain approval; an existing SMTP arrangement may avoid a new service.
- [Neon pricing](https://neon.com/pricing) could not be retrieved reliably in this session.
  Do not assume a free quota, restore window or monthly bill. T-1 must capture current
  official plan/region limits and a cost estimate before selecting/provisioning it.
- [Function limits](https://vercel.com/docs/functions/limitations) and
  [direct Blob uploads](https://vercel.com/docs/vercel-blob/using-blob-sdk#client-uploads)
  must be rechecked in the upload spike; the 20 MB product cap is a proposal, not evidence
  that the current Payload upload path supports it.

No exact combined bill is known until account plan, providers, region and retained copies
are chosen. Do not start trials, enable overage, buy services or create credentials from
this document. Reconfirm live prices at provisioning approval.
