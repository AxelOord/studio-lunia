# Hosted CMS preview

Workflow: requirements-first
Status: ready

Implementation authorized; provider direction is Neon + private Vercel Blob + Resend.
Status remains ready because hosted acceptance is pending. Axel approved separate free
preview resources and branch-scoped connections plus his account mailbox as editor/recipient
on 2026-10-04. This unpaid synthetic prototype may continue on Hobby; no paid upgrades or
commercial launch are authorized. Hosted bootstrap and protected deployment are confirmed;
the remaining hosted acceptance is still pending.

Smallest slice: one approved editor signs into the separate protected Studio Lunia
preview, uploads a synthetic photograph, saves/previews a draft, publishes it and sees
both content and image survive a redeploy. English UI/docs; no real customer data.
No booking, analytics, ad delivery, production cutover or old-site changes.

### R-1: Isolated, durable preview

Only an explicitly approved branch in project studio-lunia may use hosted CMS mode.
Database, media and credentials are separate from local tests, other branches and any
production resources. Content and derivatives survive redeploy. Other feature previews
retain showcase mode; missing/incorrect configuration fails closed.
Check: environment inventory without secret values; redeploy persistence test; non-approved branch and missing-config denial tests.

### R-2: Private, bounded media storage

Private originals and derivatives cannot be retrieved anonymously, including by direct
storage URL, guessed filename, image optimizer or cached response. Only explicitly public
media are readable by visitors inside the deployment protection boundary. Uploads require
an editor, raster validation, alt text and bounded size/dimensions; failures leave no
published broken record. Publication reversal revokes access within the documented cache policy.
Check: hosted upload/access matrix, malicious and oversized uploads, public-to-private transition, interrupted-upload cleanup.

### R-3: Editor access and recovery

One approved editor is bootstrapped once by an authenticated operator; no public signup
or persistent bootstrap endpoint exists. Login/logout, expiry and password recovery work.
Reset links are short-lived, single-use and restricted to the approved preview origin;
reset responses do not reveal account existence. No passwords or reset tokens enter logs.
Check: authorized bootstrap/repeat denial, anonymous registration denial, login/logout and reset/expired/reused-token browser tests.

### R-4: Protected drafts and preview boundary

An authenticated editor can preview an unpublished draft including private hero/gallery
images; unauthenticated CMS users cannot
read it through any page/API/media path. Preview requires a session on every request,
rejects external redirects and does not cache draft responses. Vercel Authentication,
noindex and robots disallow remain; production builds remain blocked.
Check: two independent browser contexts, session expiry, REST/Local API access tests, cache/header and deployment-configuration inspection.

### R-5: Controlled schema and recovery

Schema push stays disabled. An operator runs serialized, reviewed migrations against the
approved preview database before enabling the matching deployment. A failed migration
prevents CMS activation. A coordinated database/media backup can be restored into an
isolated disposable target and verified without overwriting the source.
Check: clean and existing-schema migration, simulated failure, recorded backup/restore drill with record counts and image hashes.

### R-6: Canary and dependency release gate

Review the exact pinned Payload canary and storage/email adapter compatibility, the admin
font patch and known braces/esbuild/DOMPurify advisories before hosted CMS activation.
Record affected paths, fixes or bounded residual-risk decisions; no blind overrides or
silent stable/canary change. Any exposed unresolved high/critical issue blocks activation.
Check: fresh audit and tagged-source review, clean install/patch verification, full foundation tests and hosted access tests.

### R-7: Observable, reviewable handover

Record exact commit/deployment, real hosted browser screenshots, functional tests, cost
limits, resource owner, teardown and recovery runbooks. Logs contain operation IDs/errors,
not credentials, private images or reset URLs. Existing vivianne-fotografie and its domains
remain untouched; no merge or deployment promotion is implied by passing tests.
Check: exact-head CI plus hosted acceptance report, log redaction test, read-only old-project comparison and approved resource inventory.
