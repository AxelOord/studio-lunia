# Release and development lifecycle

Implementation and activation gate: [spec](../specs/release-automation/design.md).
A draft PR is not an active release service. Both writer switches default off.
Actual Project Status is the selected backend. Access/setup remain subject to the
explicit gate; no label fallback, public deployment or automatic merge is implied.

Feature PRs targeting develop declare completed acceptance explicitly:

```text
Completed issues: #20, #6
```

Use `Completed issues: none` for partial/no-ticket work. Related mentions remain useful
but do not mark a ticket complete. Development links on develop do not close issues;
never put closing keywords in commits. An enabled post-verify job sets completed
open issues to Project Status Development done. It never reopens issues already closed by a maintainer.
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
verifies publication, sets manifest issues to Project Status Done, then closes them.
Missing Project access or incorrect field/options blocks closure; no labels substitute
for the board. Project items already Done are never downgraded during development
reconciliation, and archived targets require explicit maintainer handling. Retrying a failure reuses
the same tag/SHA; conflicting tags/releases fail rather than being changed. A failed
publication does not close issues. Rerun failed jobs after fixing the external blocker;
do not manufacture another version to bypass a publication failure.

Merge master back into develop afterward to preserve ancestry. This does not make a
second version commit. The previous release tag must be reachable before preparing the
next candidate. Code rollback cannot undo database/media migrations. Never move a tag.
Master/develop Vercel builds remain disabled; launch is a separate approved operation.

## Project access handoff

The approved private board is AxelOord/project1. Set LUNIA_PROJECT_OWNER=AxelOord
and LUNIA_PROJECT_NUMBER=1; the authenticated adapter resolves Project/Status option IDs
by those selectors and the exact confirmed names, without guessed opaque values.
See the complete access gate in the spec. For this personally owned
Project the proposed credential is a dedicated classic PAT with project scope only,
30-day expiration, held in environment project-status as LUNIA_PROJECT_TOKEN. That
scope can access more than one Project; approval must acknowledge this breadth.
Restrict the environment to develop/master, rotate before expiry, and never put the
credential in chat or repository files. No token has been created by this task.
