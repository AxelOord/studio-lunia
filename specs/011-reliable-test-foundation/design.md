# Reliable test foundation — design

## Immediate repair

R-1: The CMS block test's unrestricted find(media, limit: 1) is a time-of-check/use
race with other test files, which run concurrently against the same database. Its
fixture also disappears when preceding tests are not selected. Create a dedicated
synthetic image inside this test and track its returned ID for cleanup after pages.
Do not serialize the runner, retry failures or change the schema/application.

## Foundation follow-up

R-2: Introduce a local-only database fixture lifecycle for each integration suite,
including explicit Payload cache identity and suite-owned upload directory. Individual
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
