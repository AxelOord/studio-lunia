# Release automation — requirements

Workflow: requirements-first
Status: ready

## Goal and scope

Enable the previously proposed development/release lifecycle after a reviewed access
activation. This draft implements the jobs but does not merge, enable variables, issue
a real tag/release, change credentials/board configuration, or launch the website.
PR21 merged into develop at 4fed010; master remains default and issue20 remains open.

## Acceptance criteria

### R-1: Development completion

WHEN a verified develop push contains an explicitly completed issue mapping, the
system SHALL set actual Project Status to Development done without closing or reopening any issue. Reconcile
reachable merged PRs so superseded pending push jobs do not lose completion events.
Check: explicit Completed issues metadata only; ordinary mentions, partial work and
unmerged/foreign PRs do not supply completion. Existing closed issues stay closed.

### R-2: Version and frozen candidate

WHEN preparing a release, the system SHALL derive 0.x version/changelog from committed
Conventional Commits, keeping package/lock aligned. Fix/perf means patch; feature or
breaking change means minor. First release needs explicit initialRelease and curated
legacy summary. Stable1.0 is outside this workflow. Freeze after the preparation PR
merges into develop; no unrelated changes may enter that candidate.
Check: disposable Git history; valid preparation passes; incorrect version, dependency
changes and work after preparation fail validation. No local prepare command publishes.

### R-3: Intentional publication

WHEN a release/v0.x.y promotion merges into master with history preserved and the exact
resulting commit passes verify, an enabled, protected job SHALL create its immutable
version tag and GitHub Release. No ordinary master update publishes. Retries reuse only
matching tags/releases and fail closed on a different target. Website launch is separate.
Check: exact repository/PR/head/ancestry/tree validation; simulated failed publication,
retry and conflicting tag; master Vercel deployment remains disabled.

### R-4: Release completion

WHEN the matching release is proven published, the system SHALL set actual Project Status to Done and mark only manifest
issues closed-completed. Each issue must be explicitly completed by a merged
same-repository develop PR contained in the frozen source. Publication failure cannot
close issues. Reject premature native closing links/references on the promotion PR.
Check: API simulation proves publication-before-closure, Project failure-before-closure and explicit issue membership;
read-only PR validation rejects Development closing links and closing keywords.

### R-5: Access and activation

WHEN the automation is unapproved/unmerged or its switches are absent, the system
SHALL perform no lifecycle writes. Use job-scoped GITHUB_TOKEN contents/issue grants
and a separately approved Project credential confined to the project-status environment.
Missing Project access/configuration SHALL fail closed, with no label fallback.
Check: writer jobs require explicit switches, correct push branch and successful verify;
publication requires release-automation approval. Validate Project ID/URL/Status options,
paginated membership and selected option readback before claiming a board update.
No credential setup, default token permission change or provider activation occurs here.

## Open questions

The parent selected an actual user-owned GitHub Project. The native worker must confirm
its IDs/options and obtain explicit approval for classic project-scope access, protected
environment storage and activation in design.md. No credential permission exists yet. First release
membership/migration/rollback notes are deliberately supplied at candidate preparation.
