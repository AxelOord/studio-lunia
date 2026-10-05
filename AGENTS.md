# Studio Lunia — agent instructions

Read README.md, docs/architecture.md and the active spec before changes. Use English.
Follow requirements → design → tasks → implementation → tests and visual QA → small draft PRs.
Keep code readable: clear names, direct control flow and small functions with a useful purpose.
Follow docs/coding-standards.md; avoid clever abstractions, extra layers and arbitrary complexity rules.
Run `python3 scripts/specflow.py new <name>` for substantive work. Keep stable R-/P- IDs,
map them to tasks, and record real evidence before checking tasks off. Run `npm run check`,
`npm run build`, integration tests and browser tests for relevant changes. A checker verifies
structure, not truth. Bug fixes need reproduction and preservation criteria.
Use `npm run verify` for the same application/tooling stages as CI; see docs/testing.md.
Integration tests own isolated local databases and fixtures. Each test must run alone;
never borrow arbitrary rows, rely on order, weaken assertions or hide failures with retries.
Preserve the Python bootstrap/backup/connection/spec security checks when changing test runners.

Use `.agents/skills/payload/SKILL.md` for Payload work and docs/ai-tooling.md for exact-version
sources. Installed types and tagged source take precedence over generic skill examples.
Keep all Payload packages pinned together; no silent stable/canary switching.
Use `overrideAccess: false` on visitor/user Local API calls. Public reads must exclude drafts.
Do not expose CMS secrets, contact details, arbitrary URL parameters or private media.
Keep client code small; use server components and typed reusable blocks.

Use synthetic data. No invented biography, prices, reviews, availability or location.
Booking semantics await Axel's choice. Google Ads is the first future integration;
other tagged channels share the attribution model but do not yet have conversion adapters.
No tracking or consent claims without a reviewed spec. No customer CRM expansion.

Feature branches target develop; master is reserved for reviewed releases. Do not merge,
change repository permissions, purchase services, grant credentials or deploy production
without authorization. Existing authorization for draft PRs and previews carries forward.
Never overwrite unrelated work. Record blockers honestly and keep specs synchronized.

Use Conventional Commits for new commits and PR titles (for example `feat: add a gallery`).
`npm ci` installs hooks; pre-commit checks staged formatting/lint only. Fix failures
and restage intended hunks; never advance `.commit-policy.json` to bypass validation.
Keep ticket links, verification results and the exact preview in PR descriptions.
Use Completed issues metadata only for fully completed acceptance; never use closing
keywords in commits. Release implementation/activation is tracked in
specs/release-automation; its draft does not authorize provider write activation.
