# Verification record

Local verification on 2026-10-05 with Node 24.19.0 and npm 11.9.0:

- Clean `npm ci` succeeded; existing Payload patch applied and prepare installed hooks.
- `npm run check` passed: spec structure, lint, TypeScript, unit tests and Python workflow tests.
- Four focused hook tests exercise actual temporary Git repositories, staged formatting
  and lint failures, invalid messages, partial staging, merge exemptions, PR-title/range
  enforcement after hook bypass, and install guards without development dependencies.
- `npm run format:check` passed before this evidence-only addition; real pre-commit
  runs the same formatting check on every staged matching file before commit.
- Windows portability and full application build/integration/browser checks run on the
  draft PR. Their exact-head results are recorded in GitHub Checks, not claimed here
  before execution. No application UI changed, so new visual QA is not applicable.

Issue #20 is the implementation scope. Versioning/release/status remains specification
only in release-plan.md. No tags, releases, issue status changes, new write permissions,
branch protections, provider connections or production deployments are introduced.
The existing separate studio-lunia project supplies the automatic branch preview.
