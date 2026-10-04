# Payload foundation

Workflow: requirements-first
Status: done

Provide a maintainable, reviewable CMS foundation. No booking submission, advertising
connection, real customer data or production deployment is included.

### R-1: Reproducible v4 application

On a clean supported Node installation, the pinned app installs, typechecks, lints,
tests and builds with PostgreSQL migrations.
Check: npm ci; npm run check; npm run db:migrate; npm run build.

### R-2: Protected publishing

An authenticated editor can create content and preview a draft. Anonymous users cannot
write content, read users, see drafts or enable draft preview. Published content renders.
Check: integration access tests and browser preview tests.

### R-3: Safe image and reusable page foundation

Editors upload raster images with alt text and render typed hero, text and gallery blocks.
Responsive layouts have semantic headings, keyboard access and no horizontal overflow.
Check: upload integration test and desktop/mobile browser screenshots.

### R-4: AI-DLC context

Agents have local guidance, official Payload skill provenance, small spec templates,
a structural checker and CI that records reproducible checks without service credentials.
Check: npm run spec:check; inspect CI and docs/ai-tooling.md.

### R-5: Privacy-aware extension boundary

Future attribution has channel-neutral consent and outcome contracts, unknown attribution,
and Google Ads-first adapter boundaries without running trackers or collecting leads.
Check: unit tests and docs/architecture.md scope review.

### R-6: Reviewable preview setup

Vercel configuration supports a non-production foundation preview without pretending
that ephemeral database or media storage is production-ready. Existing domains are preserved.
Check: inspect Vercel project linkage and preview result; record any external blockers.
