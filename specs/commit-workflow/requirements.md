# Consistent commits and fast staged checks

Workflow: requirements-first
Status: ready

## Goal and scope

Implement approved issue #20 on current develop (168fc9b, including user-merged PR19).
Use Conventional Commits for new normal commits and PR titles. Preserve published
history and existing merge methods. No application, provider, branch-policy or issue
status/closure changes; the proposed ticket automation is paused pending a decision.

### R-1: Validate new commit messages consistently

The local commit-msg hook and CI use the same pinned commitlint configuration.
Accept conventional types/scopes/breaking changes; reject missing subjects, arbitrary
messages and fake merge/fixup prefixes. Exempt actual merge commits by topology.
Check: valid/invalid examples, actual Git merge and bypassed normal commit.

### R-2: Keep pre-commit fast and staged-only

Check formatting for supported staged files and ESLint for staged JS/TS files. Do
not build, access a database or run the full suite. Preserve partially staged and
unstaged work; handle paths containing spaces and ignored generated files.
Check: real commits reject bad formatting/lint and accept good staged content while
leaving an invalid unstaged edit unchanged.

### R-3: Make setup portable and safe

npm ci installs hooks on a clean developer checkout; CI, hosted/production installs
and non-Git exports skip installation without requiring dev dependencies. Use the
pinned Node 24 runtime, POSIX hook entrypoints and LF files for Git for Windows.
Check: Linux/Windows hook CI, clean npm ci and install-mode regression tests.

### R-4: Enforce PR policy without rewriting history

CI checks non-merge commits in base-SHA..head-SHA after the immutable published
adoption baseline 168fc9b, plus the PR title for squash
merges. Never interpolate PR text into shell code. Existing full formatting/lint CI
remains. Do not alter branch protections, default branch or merge permissions.
Check: legacy base passes, invalid added commit/title fails, full exact-head CI.

### R-5: Specify versioned releases without activating them

Document 0.x SemVer, preview identity, intentional release inclusion, development-done
versus released status, and exact develop/master promotion mechanics. Cover legacy
history, migrations, rollback and permissions. No current version bump, tag, GitHub
Release, ticket closure, project setup or persistent write automation is authorized
by this documentation addition.
Check: release-plan.md makes the sequence and unresolved setup decisions explicit.
