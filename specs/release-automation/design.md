# Release automation design

## Behavior mapping

R-1: A post-verify develop job reconciles Completed issues metadata from merged,
reachable same-repository PRs. Only explicit complete acceptance is declared this way.
Development links remain useful; a generic Related mention is not completion evidence.
Update the actual Project Status to Development done, keeping issues open. Existing
closed issues are preserved. The user delegated the backend decision and the parent
selected a GitHub Project board; there is no label implementation or fallback.

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

R-4: A separate status job revalidates candidate/membership and publication before
updating the Project Status to Done and closing issues. The job cannot create releases.
Only manifest issues are included; preflight their membership before updates. Failed
Project access/configuration blocks closure instead of using labels. Retries reuse the
same Project item/option and issue. Promotion PRs must have no native Development/closing
links and no closing keywords in new history; verify checks them before merge and the
publisher rechecks them. Keep verify required; this PR does not change protections.

R-5: GITHUB_TOKEN remains read-only except contents:write in publish-release and
issues:write in release-status. Development status only needs repository reads.
Project API access is a separate, explicitly approved credential, available only to
status jobs through the project-status environment. It is not given to verify, feature
PRs, the version preparation command or the contents-write publisher. No PR-write
permission, repository-wide write default, automatic merging, or production deployment.

## Project adapter

Require explicit Project ID/URL, Status field ID and Development done/Done option IDs.
Read back and validate their exact identities/names before any mutation. Inventory all
Project items with pagination, explicitly including archived items; fail on truncated
inventories, foreign issue identity, ambiguous membership or archived target items.
Only same-repository issues already selected by the lifecycle logic are updated. Add a
missing selected issue to this existing Project, then update its Status; never create a
Project/field/option or modify unrelated items. Read back the mutation's selected option.
Matching statuses are idempotent and Development done never downgrades an existing Done.
No issue label calls exist. Missing/expired credentials or wrong fields fail closed.

## Exact provider activation gate

The native provider worker must perform and verify setup only after explicit approval:

1. Identify/create the approved user-owned Project and link studio-lunia. Configure a
   Status field with exact options Development done and Done, preserving other options.
   Record actual IDs/URL; no guessed IDs. Confirm board-native automations do not mark
   development merges Done or close issues before verified publication.
2. Create/configure environment `project-status`, permitting only develop and master.
   The selected personal owner needs a separately approved classic PAT with **project**
   scope for Project reads/writes. `read:project` alone cannot update statuses. Do not
   add repo, workflow, admin, user or other scopes for this public repository. An org
   GitHub App is not assumed available for this personal Project; GITHUB_TOKEN cannot
   access it. Fine-grained PAT support for user-owned Projects must not be assumed.
3. Propose a dedicated token named studio-lunia-project-status, **30-day expiration**,
   stored only as environment secret `LUNIA_PROJECT_TOKEN` in project-status. The user
   creates/submits it through GitHub's secret UI after approval, never in chat, source,
   command arguments, logs or .env. No token has been created or requested as plaintext.
   Rotate the environment secret before expiry, verify read-only Project identity,
   then revoke the old token. An expired/revoked token stops status updates and closure.
4. The classic project scope is broader than a single Project: code ID/URL binding is
   an application restriction, not a credential-level scope. Explicitly approve that
   residual access. Keep protected branches/trusted workflow review and environment
   branch restrictions; possession of the credential permits broader Project writes.
5. Set non-secret repository variables from verified provider data:
   LUNIA_PROJECT_ID, LUNIA_PROJECT_URL, LUNIA_PROJECT_STATUS_FIELD_ID,
   LUNIA_PROJECT_DEVELOPMENT_DONE_ID, LUNIA_PROJECT_DONE_ID.
6. Configure `release-automation`: master only and required maintainer approval.
   Verify effective protections before enabling. Plan/tier limitations are a blocker,
   not permission to use an unprotected environment. Project credential stays in the
   separate project-status environment; the publisher receives only GITHUB_TOKEN.
7. Approve the two job-specific GITHUB_TOKEN write grants, retaining repository default
   read-only and leaving Actions create/approve-PR setting unchanged (not needed).
8. After a user-controlled reviewed merge into develop, set
   LUNIA_STATUS_AUTOMATION_ENABLED=true. Only after Project/release protection readback,
   set LUNIA_RELEASE_AUTOMATION_ENABLED=true. The push-based publisher reaches master
   through a later intentional promotion; no default-branch change/bootstrap merge.
   Existing PRs need reviewed Completed issues metadata before backfill is possible.
9. Keep master/develop Vercel deploymentEnabled=false and the production build guard.
   Record effective settings and bounded acceptance results. Disable either switch to
   pause its lifecycle; revoke the Project credential to stop all board writes.

No environment, Project, credential, switch, tag, release or issue state is changed by
this draft implementation. Choosing the board does not itself authorize the credential.

## Release Please assessment and sources

[Release Please](https://github.com/googleapis/release-please-action) supports independent
release branches, target-branch and skip modes. Its [manifest implementation](https://github.com/googleapis/release-please/blob/main/src/manifest.ts)
finds merged release PRs through the configured targetBranch. Switching from develop
preparation to master therefore does not directly provide the complete promotion
transaction. A bot plus additional credentials/dispatch would add permissions and another
version path; this implementation uses local preparation and explicit publication.

[GitHub linked-issue behavior](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue)
closes linked issues at default-branch merge, not develop. PR21 merged into develop at
4fed010 while issue20 stayed open. On master promotion, closing links are absent so
successful publication remains the completion gate.

[GitHub token permissions](https://docs.github.com/en/actions/tutorials/authenticate-with-github_token)
support job-specific scopes. [Project Actions documentation](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/automating-projects-using-actions)
states GITHUB_TOKEN cannot access Projects and recommends a PAT for user Projects.
[Project API authentication](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-api-to-manage-projects)
documents the classic project scope; the [current GraphQL schema](https://docs.github.com/en/graphql/reference/projects)
defines the item/Status mutations and archived-item filtering used by the adapter.
