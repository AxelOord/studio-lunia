# Studio Lunia

A photography website foundation using Payload **4.0.0-canary.37**, Next.js **16.3.8**,
React **19.2.6**, PostgreSQL and Node **24.19.0**. This is a prerelease foundation for
review, not the live Lunia site. Booking, advertising integrations and tracking are not enabled.

## Local development

```sh
npm ci
cp .env.example .env
# Set PAYLOAD_SECRET to a random 32+ character value.
# Set SEED_EMAIL and SEED_PASSWORD (16+ characters) for your local editor.
docker compose up -d
npm run db:migrate
npm run seed
npm run dev
```

Open http://localhost:3000 and /admin. The seed is idempotent and preserves existing
editors/content. First-user web registration is blocked; bootstrap only via the local
seed command. Never use the example database password outside local development.
Email delivery is not configured; local Payload logs email instead. Password reset
requires a reviewed email adapter before any hosted CMS launch.

`media/` persists between local app restarts but is untracked. PostgreSQL uses a named
Docker volume. Back up both together. Do not use either as Vercel filesystem storage.

## Verification

```sh
npm run check
npm run test:integration
npm run build
npx playwright install chromium
npm run test:e2e
npm run format:check
```

Integration tests use the configured local database, create uniquely named synthetic
records and clean them up. Never run against a production database. E2E needs the local
seed credentials and a built app; Playwright starts `next start`. Set
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium` if using system Chromium.
Screenshots/traces are in ignored `test-results/` and `playwright-report/`.

## Environment

| Variable                   | Purpose                                                              |
| -------------------------- | -------------------------------------------------------------------- |
| DATABASE_URL               | PostgreSQL connection, server-only; required in CMS mode             |
| PAYLOAD_SECRET             | Random 32+ character signing secret; server-only                     |
| NEXT_PUBLIC_SERVER_URL     | Documented local origin for future links; no secrets                 |
| SEED_EMAIL / SEED_PASSWORD | Local bootstrap/test account; never deployed                         |
| LUNIA_SHOWCASE             | Explicit sample-only preview mode; CMS/API/preview routes return 503 |

No secrets are committed. Hosted CMS remains gated on approved private Blob, Neon, Resend, migrations and access
controls. See docs/hosted-cms-runbook.md for the prepared integration and pending hosted evidence. Vercel production builds
are blocked. See docs/vercel.md for separate preview setup.

## Structure and workflow

- `src/collections`: users, media and draftable pages.
- `src/blocks` and `src/components`: typed reusable page blocks and rendering.
- `src/lib/attribution.ts`: future consent/outcome contracts; no active tracking.
- `specs/001-payload-foundation`: requirements, design, tasks and evidence.
- `docs/architecture.md`: scope and follow-on specs.
- `docs/ai-tooling.md`: version-matched official AI resources and MCP decision.

Read AGENTS.md before working. Create a spec with `python3 scripts/specflow.py new <name>`.
The checker maps acceptance criteria to tasks but does not execute tests or prove evidence.
Use small feature branches targeting develop, draft PRs and explicit verification.
Master is reserved for reviewed releases. No automatic merging or production promotion.
