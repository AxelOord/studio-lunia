# Versioning and release plan — specification only

Approved addition to this spec on 2026-10-05. The implementation in this PR remains
commit hooks and read-only checks for issue #20. No release, tag, status change,
provider connection, GitHub Project or persistent write automation is created.

## Version and status meanings

Use application SemVer **0.x** during development: fixes increment patch, features
increment minor, and breaking 0.x changes increment minor with explicit migration
notes. A stable **1.0.0** is a deliberate readiness decision. Payload's dependency
version is independent; this does not upgrade or stabilize its canary API.

Preview identity is branch + exact commit SHA (already available in Vercel metadata),
not a new package release for every build. The current package value 0.1.0 does not
itself prove a tagged or published release; inspect actual tags/releases before the
first release and agree its version/baseline. Do not retrospectively invent releases.

A feature PR merged into **develop** means **Development done**, while its issue
stays open. A reviewed release merged into **master**, with a verified tag/release,
means **Done** only for explicitly included, completed issues. Review approval alone
changes neither state. Public website launch/deployment remains a separate decision.
A GitHub Project custom Status or a repository label could represent Development
done; that storage choice and permissions are still undecided. No setup is implied.

## Smallest proven release sequence

Start with a maintainer-driven release; automate this sequence only after it works.

1. Select a candidate develop SHA and inventory merged PRs since the previous release.
   Curate user-visible changes, migrations and an explicit list of completed issues.
   Use verified same-repository Development/closing links and issue acceptance, not
   every issue number mentioned in commits, comments or the backlog. Partial tickets
   and work outside the selected candidate stay open. PR membership must be proven
   by commit ancestry; a PR number in prose is not sufficient evidence of inclusion.
2. Make a small release-preparation PR **into develop**. Update package.json and its
   lockfile together using `npm version <version> --no-git-tag-version`, a curated
   CHANGELOG entry, and a release manifest recording version, previous tag, selected
   PRs/issues and migration/rollback notes. Recheck the candidate if develop moves
   before preparation merges. No tags or GitHub Release are made in this step.
3. After that PR merges, freeze a `release/<version>` branch at the exact resulting
   develop SHA. This is the release candidate; later develop commits are excluded.
   Open its promotion PR **to master**, carrying the already-reviewed version and
   changelog. Do not let a second bot generate another version commit on master.
   Block promotion if the candidate, manifest or included migrations no longer match.
4. Use a history-preserving merge for promotion; do not squash/rebase the whole
   develop history into master. The merge commit is the release SHA. Verify all
   required checks for that SHA and the committed manifest/version before creating
   immutable tag `v<version>` and the GitHub Release at that exact commit. An existing
   tag must match; never move it on retry. Failed publication is retried idempotently,
   not treated as successful Done status. No workflow in this PR performs these writes.
5. Mark only completed manifest issues Done after successful release verification.
   GitHub's default-branch closing keywords can act at merge time, earlier than tag
   publication: choose that timing explicitly before introducing them. For the
   stricter release-complete gate described here, avoid automatic closing keywords
   in the promotion PR and audit included commit closing references; otherwise GitHub
   could close issues before the gate. A future writer must use the manifest and
   recorded release SHA, not arbitrary related mentions. Never close all open tickets.
6. Merge master back into develop to retain the promotion merge ancestry. The version
   and changelog already exist on develop, so this synchronizes history without a
   duplicate release/version commit. Do not rewrite published commits or force-push.

This deliberately chooses a complete candidate snapshot, not arbitrary cherry-picks.
Selective releases require a separately reviewed branch/manifest strategy. Production
hotfixes must also be reconciled back into develop before the next candidate.

## Legacy history, migration and rollback

Existing history contains unstructured messages. The hook policy fixes its immutable
adoption baseline at `168fc9b`; CI ignores only that already-published ancestry, while
checking all new normal commits and PR titles. The first changelog is curated from
verified merged PRs rather than pretending old commits are conventional or rewriting
them. Missing issue links require an explicit decision before including a ticket.

For each release record compatible code/database schema, new migrations, whether they
are reversible, and a verified database/media backup and restore plan. A code rollback
does not undo a data migration. Preview databases/media are not production backups.
Rollback chooses a previously verified compatible version or a forward fix; do not
move a published tag, assume a destructive down-migration is safe, or auto-reopen all
previously completed issues. Record affected regressions separately.

## Tool choice and authorization boundary

[Release Please Action](https://github.com/googleapis/release-please-action) supports
`target-branch` and separating release-PR creation from GitHub-release creation. Its
normal model creates a release PR against that target and releases after that PR is
merged; the documented inputs do not establish the full candidate promotion above.
Pointing it at develop could publish a release before master; pointing it at master
creates a separate release-PR/version-commit path requiring synchronization. Do not
claim native develop→master promotion. Prefer the manual first release over an
unproven multi-branch bot. This is a design choice, not a claim that custom Release
Please orchestration is impossible.

Any future automation needs a concrete follow-up implementation: read-only candidate
validation first; then narrowly scoped `contents: write` for tags/releases and, only
if chosen, `issues: write` for issue labels/closure. Project-v2 status updates require
an explicitly selected Project/field and an appropriately authorized app/token;
repository GITHUB_TOKEN access must not be assumed sufficient. No PAT, app installation,
repository-wide write default or branch-protection change is authorized here.

Confirm exact workflow/event placement before activation. In particular, current
[GitHub event documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request_target)
says pull_request_target executes default-branch workflow context. With master as
default, a workflow merely added to develop must not be represented as active there.
No issue-closing workflow was added after the request to pause that approach.
