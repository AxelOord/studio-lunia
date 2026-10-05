# Reliable test foundation — requirements

Workflow: bugfix
Status: ready

## Problem and scope

[#36](https://github.com/AxelOord/studio-lunia/issues/36) precedes admin usability #35
and follow-up scheduling #25. PR34 head a458215 failed CI run 37365324916:
editorial blocks selected arbitrary media ID 3 while the parallel Blob suite could
delete it, causing PostgreSQL foreign-key violation 23503. A clean standalone run
also lacks media because the test borrows a preceding test's fixture. First repair
this ownership defect in PR34; deliver the broader runner/isolation work separately.

## Acceptance criteria

### R-1: Regression reproduces and the immediate fix owns its fixture

The editorial-block test SHALL create and clean up its own image, preserve all
assertions and run alone on a clean migrated database as well as in parallel suites.
Check: Record the failing standalone reproduction, repeated clean-database passes
and exact-head aggregate CI after the minimal PR34 change; no retries or serial-only mask.

### R-2: Integration fixtures are isolated and independently runnable

Integration suites SHALL use real, isolated local PostgreSQL databases and owned
fixtures, with deterministic setup and guaranteed cleanup. Tests SHALL not depend
on another test's ordering, hard-coded IDs or unscoped mutation of shared records.
Check: Run selected tests alone, repeat clean-database runs and verify concurrent
suite isolation, failed-setup cleanup and refusal of hosted database targets.

### R-3: Coherent pinned runners and preserved coverage

Use a pinned Vitest unit/integration entry point and Playwright user flows, retaining
existing meaningful assertions. Inventory all checks before moving them. Keep unique
Python bootstrap, backup, connection and spec/security coverage. Consolidate standalone
application checks only when their original assertions are preserved in the main suites.
Check: A before/after coverage map, all retained security checks and meaningful negative
cases pass; no superficial counts, retry masking or unrelated infrastructure rewrites.

### R-4: Local verification matches clear CI stages

One documented command SHALL run the same lint/type, unit, integration, build and
browser verification as CI with pinned versions, useful failure diagnostics and
browser screenshots/traces. Release/security settings remain unchanged.
Check: Clean local full run and exact-head CI, with deliberately failing fixture
setup stopping dependent stages and producing actionable diagnostics.

### R-5: Actual browser journeys retain important boundaries

Browser verification SHALL retain real admin/public flows, repeated clicks, error
recovery, cancellation/back navigation where applicable and anonymous access denial.
Check: Playwright regression suite and inspected desktop/mobile screenshots; automatic
protected CMS preview on the exact head, with hosted limitations stated honestly.

### R-6: Readable coding standards have useful enforcement

Audit strict TypeScript, lint/format, module boundaries, input validation, error handling
and shared authorization. Add missing reliable checks and concise agent guidance without
blanket rewrites, clever abstractions, extra layers or arbitrary complexity limits.
Check: Document existing guarantees and targeted gaps; lint/type/boundary checks pass,
negative checks fail meaningfully, and an independent review covers maintainability.

### P-1: Preserve product behavior, security and unique checks

The test repair SHALL not change product logic, loosen assertions, disable tests,
add blind retries, modify credentials/security settings or activate external services.
Check: Reviewed diff, test inventory and all existing behavior/security checks pass.

### P-2: Preserve the approved preview account behavior

Existing preview accounts/passwords SHALL remain unchanged. No secret value is read,
printed or reset. User owns all merges and production remains out of scope.
Check: Preview bootstrap preservation checks and exact-head protected preview evidence.
