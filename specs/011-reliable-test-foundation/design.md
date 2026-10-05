# Reliable test foundation — design

## Immediate repair

R-1: The CMS block test's unrestricted find(media, limit: 1) is a time-of-check/use
race with other test files, which run concurrently against the same database. Its
fixture also disappears when preceding tests are not selected. Create a dedicated
synthetic image inside this test and track its returned ID for cleanup after pages.
Do not serialize the runner, retry failures or change the schema/application.

## Foundation implementation

R-2: Introduce a local-only database fixture lifecycle for each integration suite,
including an explicitly owned Payload instance and suite-owned upload directory. Individual
tests create their required records independently; cleanup only owned records. Migrate
real PostgreSQL rather than mocking relational guarantees. Preserve race/idempotency
assertions that intentionally run concurrent operations within one fixture.

R-3: Inventory existing Node, Python, Playwright and standalone scripts first. Pin
Vitest after checking its current official Node24/API contract. Keep Python as a
named verification stage for the Python tools themselves; moving languages without
a coverage benefit is not a goal. Move application checks into the relevant suite
only with the same meaningful boundaries and failure assertions.

R-4: Expose a single local verification entry point using the same named stage commands
as CI. Preserve existing release jobs, hook portability and security settings. Retain
logs plus Playwright traces/screenshots on failures, with no retry-based pass masking.

R-5: Keep existing actual-browser flows; add missing cancellation/navigation cases
where the tested feature supports them. Inspect responsive screenshots and verify the
protected automatic preview on the final commit without claiming untested live providers.

R-6: Keep strict TypeScript and zero-warning lint/format as the baseline. Inspect existing
authorization and validation boundaries before adding focused enforcement. Write concise
examples of clear names, straightforward control flow and behavior-oriented tests; preserve
sound modules and use independent review for correctness and maintainability.

P-1, P-2: The immediate PR34 fix is test-only. A separate foundation PR carries runner
and isolation changes so reviewers can distinguish the bug repair from infrastructure.
No hosted database/secret is used by tests; existing accounts/passwords are preserved.

## Runner and fixture details

Vitest 5.0.3 has separate unit, integration and build projects. The integration
project uses two fork workers and real PostgreSQL 17. Each suite creates a random
local database, migrates the committed migration index, and resets only its own
public tables between cases. Each case creates its prerequisites. An uncached Payload
instance and temporary upload directory prevent shared-instance/file collisions.
Teardown closes Payload and its pool before dropping that database. A failed config
setup exercises cleanup. Hosted targets and host-override query parameters fail before
connection; test process setup overrides inherited provider settings with inert values and uses synthetic
credentials. Explicit provider contract tests inject their own fake boundaries.

Pinned Payload's filesystem migration loader bypasses Vitest's TypeScript loader.
Integration uses the committed migration index through Vitest; the browser fixture's
real Payload CLI migration and hosted preview still verify filesystem discovery.
DROP DATABASE deliberately uses graceful connection closure: FORCE caused an idle
application pool to emit an unhandled termination error in the first fixture experiment.

Playwright owns a separate migrated/seeded database and starts three local servers:
CMS, credential-free showcase and private-upload metadata. The upload test blocks
non-local browser requests. Browser artifacts live in test-results/browser so Playwright
cannot erase Vitest's sibling JUnit reports. All retries remain zero. A normal stage
failure still runs database cleanup; force-killing a process or PostgreSQL is outside
JavaScript cleanup guarantees.

`npm run verify` and CI call the same named checks. Python security/tooling, Node hook
portability and release checks stay intact. A small seed finally block also closes the
PostgreSQL pool held by the pinned canary adapter, allowing the next stage to start.
There are no application schema, product behavior or external activation changes.

Strict TypeScript and existing lint remain. Focused rules reject unobserved promises,
raw application console output and private database/provider imports in UI modules.
Negative lint tests prove rejection while allowing shared types. Server-rendered view
files remain explicit, with review and the Next build checking client boundaries.

A lifecycle review found that getPayload only returns the instance after initialization.
An onInit failure after opening the pool therefore hid that pool from fixture cleanup:
the new regression reproduced PostgreSQL 55006 during DROP DATABASE. The fixture now
constructs the pinned exported BasePayload before calling init, so it can always close
its own partially initialized instance. Configuration and initialization failure cases
both assert database removal, temporary-directory removal and environment restoration.
The regression's own finalizer also removes its captured database if the assertion fails.

Independent review identified one blocker: deleted environment keys were restored when
fresh Payload/Playwright/Next processes loaded local environment files. Temporary files
with synthetic sentinel values reproduced this in both dotenv and the pinned @next/env
loader: private-blob was restored, and the unpooled database URL could also be restored.
The test environment now keeps explicit inert provider values. Browser subprocesses pin
DATABASE_URL, DATABASE_URL_UNPOOLED and TEST_DATABASE_URL to their owned database.
Integration fixtures pass their owned database directly to the adapter and update DATABASE_URL;
the unused unpooled alias remains the validated local baseline. Dotenv override/key
options are inert too. Two subprocess regressions load .env/.env.local/.env.production
and assert isolation without opening a database or contacting any provider. The original
showcase server-rendered HTML assertion is restored alongside browser rendering checks.
