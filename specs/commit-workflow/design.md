# Developer workflow design

R-1: Husky calls a Node wrapper around commitlint 21.2.3/config-conventional. Disable
text-based default ignores; only MERGE_HEAD locally and actual multi-parent commits
in CI exempt merges. Optional scopes and proper names in subjects remain allowed.

R-2: lint-staged 17.6.0 checks Prettier and ESLint with argument-safe filename handling.
Check-only commands avoid rewriting user work; lint-staged retains its normal backup
and partial-staging protection. Generated files retain existing ignore rules.

R-3: Husky 9.1.7 prepare guard skips CI/VERCEL/production/HUSKY=0/non-Git exports before
importing dev dependencies. No blanket error suppression on real developer installs.
POSIX hooks and Git LF normalization support Windows; test actual temporary Git repos
on Ubuntu and Windows. No application runtime/dependency versions are changed.

R-4: The existing read-only verify job checks exact head against event base, with full
history and PR title passed as an environment value. edited events refresh title
validation without introducing a new required check name. A separate read-only Windows
portability job verifies real Git hooks; no branch-protection setting changes. Repository currently permits merge/squash/rebase; title validation covers
GitHub's squash subject. GitHub merge commits remain exempt. Existing base commits,
including PR19, remain untouched. `.commit-policy.json` fixes the published adoption
baseline at 168fc9b; its ancestors are exempt even in a future master promotion PR.
New commits and PR titles remain checked; the baseline must not advance to hide errors.

No UI change needs visual QA. Existing full application CI runs on the PR; focused
hook tests prove staged isolation, merge behavior, bypass detection and installation.
Ticket closure/status automation is intentionally excluded after the latest steering.

R-5: release-plan.md describes a human-reviewed SemVer/release-candidate process.
Release Please is not installed: target-branch support does not by itself implement
develop-to-master promotion. Release/status automation remains a separately authorized
follow-up; this PR grants no GitHub write permissions.
