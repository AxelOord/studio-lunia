# Design

R-1: One Next.js 16.3.8 / React 19.2.6 app with Payload 4.0.0-canary.37, Node 24,
PostgreSQL and explicit migrations (schema push disabled). npm lockfile pins transitives.
R-2: Users are editors; authenticated CMS operations only. First user is created by
an explicit local bootstrap script. Anonymous content reads filter published records.
Preview checks a CMS session, validates the slug and sets Next draft mode. Every draft
page request authenticates again; preview is uncached and noindex.
R-3: Pages contain typed hero/text/gallery blocks. Media are explicitly public or private,
accept raster images only, require alt text and generate derivatives. No real brand assets exist.
R-4: Adapt the playground checker to root specs; vendor only the official Payload skill.
CI uses an isolated PostgreSQL service and synthetic content. No automatic production deploy.
R-5: Pure typed contracts and consent-gated sanitization define attribution/outcomes;
no cookie, event collector, platform call or lead storage is added in this foundation.
R-6: Vercel needs durable PostgreSQL, media storage and protected secrets for CMS mode.
An explicit showcase mode can render synthetic sample content without a CMS connection;
CMS endpoints fail closed in that mode. It is not a working hosted CMS.
