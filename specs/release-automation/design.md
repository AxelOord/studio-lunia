# Release automation design

## Behavior mapping

R-1: A post-verify develop job reconciles Completed issues metadata from merged,
reachable same-repository PRs. Only explicit complete acceptance is declared this way.
Development links remain useful; a generic Related mention is not completion evidence.
Existing closed issues are preserved. No polling app, issue reopen, or closing keyword.

R-2: `release:prepare` is a local deterministic command. Reviewed input outside the
checkout selects completed issue→PR mappings and summary/migration/rollback notes.
It writes package/lock, CHANGELOG and .release/candidate.json only. The first release
explicitly adopts current 0.x package version; legacy history before168fc9b requires a
curated summary. Subsequent releases use the previous reachable published version tag.
A preparation PR goes to develop. Freeze release/vVERSION at its merged SHA; later
work on develop is excluded. Validation rejects unrelated edits after sourceSha and
checks the generated notes/history, version, lockfile and candidate tree.

R-3: Extend existing verify to master pushes and add read-only promotion validation on
PRs. The writer runs only after exact post-merge verify, explicit activation and a
protected release-automation environment. It requires the merged release/vVERSION PR,
two-parent merge, candidate in develop ancestry, unchanged candidate tree and matching
manifest. Create a lightweight immutable tag then GitHub Release; fail/retry safely if
publication stops between them. No release event chaining: GITHUB_TOKEN-created events
do not start new Actions runs. No GitHub Release is created during this implementation.

R-4: A separate issues-write job revalidates candidate/membership and publication
before closure; it cannot create releases. Done labels and closed-completed state use
only manifest entries. Preflight all memberships. Repeated closure is idempotent.
Promotion PRs must have no native Development/closing links and no closing keywords in
new commit history; read-only verify checks them before merge, and publication checks
again. Keep verify required when configuring protections; this PR does not edit them.

R-5: Workflow default is contents/pull-requests/issues read. Job grants are separated:
development-status and release-status get issues:write (contents/pull-requests read);
publish-release gets contents:write (issues/pull-requests read). No PR write, new token,
Actions-create-PR setting, or repository-wide write default. The implementation uses
labels as the least-privilege status backend pending the explicit provider choice.
Project Status synchronization is not claimed or implemented.

## Exact provider activation gate

After approval of these permissions and normal code review (no merge is performed here):

1. Confirm issue labels Development done and Done are the selected status backend.
   Jobs create only these labels if absent. Parent/native provider worker may configure
   a Project's own issue-closed→Done automation; do not claim Development done field
   synchronization. A custom Project Status writer needs separately authorized Project
   access (GITHUB_TOKEN cannot do it), actual Project/field/option IDs and a new review.
2. Create/configure GitHub environment `release-automation`, restrict it to master and
   require maintainer approval. Verify protections actually apply before activation;
   plan/tier limitations are a blocker, not permission to create an unprotected gate.
3. Approve the job-scoped grants above. Keep repository default token read-only and
   Allow GitHub Actions to create/approve PRs unchanged (not needed).
4. Merge the reviewed implementation via the normal user-controlled process to develop;
   then set repository variable LUNIA_STATUS_AUTOMATION_ENABLED=true. No retrospective
   statuses are fabricated: existing PRs need reviewed Completed issues metadata.
5. Set LUNIA_RELEASE_AUTOMATION_ENABLED=true only after environment/protection review.
   The writer is first available on master when an intentional release promotion brings
   this workflow there. It uses push, not default-branch-only dispatch/pull_request_target.
   No branch/default change or standalone bootstrap merge to master is required.
6. Keep vercel.json master/develop deploymentEnabled=false and production build guard.
   Record actual switches, environment restrictions and effective grant verification.
   Disable either variable to pause that class of writes; retries retain tag identity.

## Release Please assessment and sources

[Release Please](https://github.com/googleapis/release-please-action) supports independent
release branches, target-branch, skip-github-release and skip-github-pull-request. This
is not a native release-preparation-on-develop then promotion-to-master transaction.
Using target develop would recognize a release there; target master introduces another
release PR/version commit. GITHUB_TOKEN-created PRs do not trigger ordinary Actions CI.
A bot plus app/PAT or explicit dispatch orchestration would add permissions and another
version source. This implementation therefore uses a small tested local preparation
command and explicit promotion workflow, with no Release Please dependency or bot.

[GitHub linked-issue behavior](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue)
closes linked issues at default-branch merge, not develop. Live evidence: PR21 is merged
into develop (4fed010), default remains master, issue20 was still open on2026-10-05.
The generic native tooltip is not evidence of closure on develop. On promotion to master,
closing links are intentionally absent so publication remains the completion gate.

[GitHub token permissions](https://docs.github.com/en/actions/tutorials/authenticate-with-github_token)
support job-specific scopes. [Project automation](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/automating-projects-using-actions)
explicitly states GITHUB_TOKEN cannot access Projects. A user Project normally needs a
separately approved PAT; an organization Project can use an appropriately scoped app.
Neither is created, requested as a secret, or assumed here.
