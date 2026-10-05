# Automatic PR previews

Workflow: requirements-first
Status: ready

Axel authorized automatic working PR/commit previews on 2026-10-05. These previews are
explicitly read-only synthetic frontend previews, not hosted CMS acceptance. No secret
scope expansion, production deployment, old-site change or database migration is included.

### R-1: Automatic isolated previews

Trusted feature branch pushes and PR updates can trigger the existing studio-lunia Vercel
Git integration. Master/develop and the credential-bound legacy CMS branch remain excluded.
Check: inspect deploymentEnabled rules; verify external Git settings and deployed commit.

### R-2: Meaningful credential-free review

Home and /blocks render all six reusable block types with local synthetic raster images,
working navigation, responsive layout and a persistent read-only notice. CMS/API/draft
routes stay unavailable; unknown sample routes return 404; noindex remains enabled.
Check: run showcase browser checks without CMS credentials, decode images, navigate both pages and inspect 1440/390px screenshots.

### R-3: Honest handover and trusted code boundary

Replace closed PR4 with a draft PR to develop without merging or recreating its deleted
base. Preserve CMS isolation, runtime production rejection and spec002 acceptance gaps.
Do not grant fork code secrets or bypass Vercel's approval policy. Record exact CI and
external deployment evidence separately.
Check: PR base/head, green CI, metadata-only configuration checks and deployment verification.
