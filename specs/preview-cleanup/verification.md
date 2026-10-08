# Preview cleanup — verification checkpoint

## Admission and isolation

On 2026-10-08, GitHub issue/PR searches for cleanup, lifecycle and retention, the open PR
inventory, matching remote branch names and local worktrees found no existing cleanup task.
Open product drafts were #38–42, #44 and #45. Created issue #46 as the sole cleanup task.
The independent worktree `/workspace/studio-lunia-cleanup` branches from unchanged develop
`5f1669e8bb490b64e2bd5ee74a63878bea5f67fc`; PR #45 remains at
`e2c0aab1740a78a2bcff69b3bfc1ca5028ed4113` in its original clean worktree.

## Focused evidence

`npm run test:cleanup`: 82 tests passed. The first 78-case run had one assertion error:
a workflow source scan matched the comment “No npm install” as an installation command.
The test now strips YAML comment lines before checking executable content. The other
77 cases passed. Four further cases verify manual fork selection before Vercel access,
reopening before any deletion, explicit PR metadata and sanitized timeout/JSON failures.
No retry, timeout or existing assertion was weakened.

Coverage includes exact repo/team/project/link/PR/commit/full-ref ownership; deleted/fork
repositories; protected/shared/open refs; native terminal preview targets; commit-history
limits; complete bounded HTTP pagination; duplicates, missing and malformed metadata;
GET-only/no-redirect transport; hard CLI/adapter deletion denial; default-branch workflow
and fork guards; local lock contention; final-deployment ordering; repeat/idempotent runs;
reopening/ref recreation/project reassignment/promotion/new-deployment races; lost write
responses; already absent IDs; stop-on-failure journals and fresh-state recovery.

No cleanup command used live provider credentials or made a deletion request. The controller
is separate from the app and changes no UI/schema; application browser checks are preserved.
Provider schemas/permissions and native Neon slot reclamation need separate operational
acceptance. Revalidation is not an atomic transaction across GitHub and Vercel.

## Aggregate and publication

Full local `npm run verify` passed on 2026-10-08: static/generated checks, 34 unit,
32 PostgreSQL integration, 35 Python, 4 hook, 12 release, 82 cleanup, 1 built-dependency
and all 21 browser journeys, plus the production build. Browser retries remain zero.
Log: `/tmp/lunia-cleanup-verify.log`; focused log: `/tmp/lunia-cleanup-focused.log`.
Exact-head CI and the ordinary automatic preview will be recorded in the draft PR
conversation; local success does not establish live cleanup or hosted acceptance. No live deletion, management setup, secret,
security, billing, production, PR merge or unrelated roadmap work is authorized by this task.

## Terminal pagination compatibility

The first ordinary preview inventory at head 0311e3f returned a counted terminal page
with no `pagination.next` property. Review found the adapter incorrectly demanded an
explicit null. It now accepts omitted/null terminal cursors only with a valid count
matching the returned rows; malformed/repeated cursors and missing/inconsistent counts
still fail closed. The focused suite passes all 85 cases after this correction, and
`npm run check:static` passes. The earlier full aggregate remains the unchanged application
regression evidence; exact-head CI runs the full aggregate with the corrected adapter.
No live management token or cleanup execution was used. The initial ordinary deployment
`dpl_29yeDAZLPyrakpJMy8EWgsFzJMjh` reached READY at 0311e3f; this is application deployment
evidence, not lifecycle activation. Final-head evidence belongs in the PR conversation.
