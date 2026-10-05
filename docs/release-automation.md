# Release and development lifecycle

Implementation and activation gate: [spec](../specs/release-automation/design.md).
A draft PR is not an active release service. Both writer switches default off.
No Project Status field, public deployment or automatic merge is implied.

Feature PRs targeting develop declare completed acceptance explicitly:

```text
Completed issues: #20, #6
```

Use `Completed issues: none` for partial/no-ticket work. Related mentions remain useful
but do not mark a ticket complete. Development links on develop do not close issues;
never put closing keywords in commits. An enabled post-verify job labels completed
open issues Development done. It never reopens issues already closed by a maintainer.
Older PRs need explicit reviewed completion metadata before any backfill can occur.

## Prepare an intentional release

Start a clean preparation branch from current develop after fetching tags. Write input
outside the checkout, for example /tmp/lunia-release-input.json:

```json
{
  "initialRelease": true,
  "summary": "Curated first-release scope including the reviewed legacy features.",
  "migration": "Describe schema/media changes and the verified backup/restore plan.",
  "rollback": "Record the compatible prior code/schema or a reviewed forward-fix plan.",
  "issues": [{ "number": 20, "prs": [21] }]
}
```

This is an input example, not authorization to release issue20. Confirm each issue's
acceptance and Completed issues metadata. Set initialRelease only for the first tag.

Run `npm run release:prepare -- /tmp/lunia-release-input.json`, format the generated
files, and review package/lock, CHANGELOG and .release/candidate.json in a PR to develop.
Fix/perf increments patch; features/breaking changes increment minor while below1.0.
The first tag deliberately adopts the existing 0.x package version and curated legacy
notes. A tooling-only change does not force a subsequent release. No command pushes.

After preparation merges, freeze `release/vVERSION` at that exact develop SHA. Open a
promotion PR to master with **no Development closing links and no closing keywords**.
The manifest explicitly selects completed issues; all other issues stay open. Keep the
candidate unchanged and use a normal merge commit, never squash/rebase the whole tree.
CI validates the frozen candidate and early-close references before merge. The exact
master merge is tested again before protected publication. Do not approve publication
until candidate, migrations and environment configuration have been reviewed.

The enabled publisher creates an immutable tag and GitHub Release; a separate job then
verifies publication and marks manifest issues Done/closed. Retrying a failure reuses
the same tag/SHA; conflicting tags/releases fail rather than being changed. A failed
publication does not close issues. Rerun failed jobs after fixing the external blocker;
do not manufacture another version to bypass a publication failure.

Merge master back into develop afterward to preserve ancestry. This does not make a
second version commit. The previous release tag must be reachable before preparing the
next candidate. Code rollback cannot undo database/media migrations. Never move a tag.
Master/develop Vercel builds remain disabled; launch is a separate approved operation.
