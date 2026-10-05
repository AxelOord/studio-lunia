# Testing Studio Lunia

Use Node 24.19.0, npm 11.9.0 and the committed lockfile. PostgreSQL 17 is provided by
`docker compose up -d`. Configure the local `.env` from `.env.example`, then:

```sh
npm ci
npx playwright install chromium
npm run verify
```

On this executor, use `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium` for the
installed Chromium. No provider account, credential or hosted database is needed.

`npm run verify` runs the same application stages as CI: lint/types/format/spec checks,
Vitest unit tests, Python security/tooling plus Git hooks/release tests, real PostgreSQL
integration tests, the build/generated-file check, built-dependency tests and Playwright.
GitHub additionally validates PR metadata and hook portability on Windows. No retries
turn a failing application test into a passing build.

| Command                               | Purpose                                                                      |
| ------------------------------------- | ---------------------------------------------------------------------------- |
| `npm run check:static`                | Lint, strict types, formatting and spec traceability                         |
| `npm run test:unit`                   | Fast application behavior and test/standards guard tests                     |
| `npm run test:tooling`                | Python bootstrap/backup/connection/spec security, hooks and release behavior |
| `npm run test:integration`            | Real migrations, access, transactions, idempotency, fixtures and recovery    |
| `npm run build && npm run test:build` | Compiled application and actual traced dependency subset                     |
| `npm run test:e2e`                    | Real CMS/public journeys, showcase and private-upload metadata               |

## Isolation and selected tests

Integration fixtures create a random database on the local PostgreSQL server and a
private temporary media directory. Each case resets only its suite's owned tables and
creates its prerequisites. Each fixture owns an uncached Payload instance before initialization, so even a failed initialization hook can close its pool. Cleanup
closes its pool, drops only the created database and removes only its temporary directory.
Failed setup is tested. Integration and browser processes remove inherited provider settings and use synthetic credentials. The fixture refuses Vercel/production, remote hosts and connection
parameters that could override the hostname. `TEST_DATABASE_URL` can select another
**loopback** PostgreSQL server with permission to create/drop test databases.

```sh
npm run test:integration -- tests/integration/cms.test.ts -t 'editorial blocks'
npm run test:integration -- --sequence.shuffle --sequence.seed=36
npm run test:unit -- tests/inquiry.test.ts
npm run test:e2e -- --project chromium -g 'private endpoint'
```

Vitest runs integration files concurrently with two workers; intentional transaction
races remain concurrent inside each case. No shared developer records are borrowed or
truncated. Browser verification creates and seeds a separate database, then removes it
when Playwright finishes or fails. It uses ports 3000–3002 and refuses to reuse another
server; do not run two browser verifications simultaneously in one workspace.

## Evidence and external limits

Vitest writes JUnit results under `test-results/`. Playwright retains failure screenshots,
traces and its HTML report, plus selected desktop/mobile screenshots. CI uploads these as
`verification-evidence`, including on failure. Preserve the first failure and diagnose it;
do not re-run until a changed fixture, code or environment explains why a rerun is useful.

The two former standalone browser checks now run in Playwright's `showcase` and
`private-upload` projects. The upload tracing check is a Vitest build test. Existing
`test:showcase`, `test:upload-metadata` and `test:upload-trace` names remain aliases.
Python remains because it tests Python operator tools and their real security boundaries;
it is not a second application test framework. See the [coverage inventory](../specs/011-reliable-test-foundation/inventory.md).

Fake provider boundaries verify our contracts, not hosted permissions or delivery.
The upload project blocks browser requests leaving localhost. Analytics and real customer
mail remain disabled. Hosted acceptance uses a protected automatic preview on the exact
commit and is reported separately from local/CI results.
