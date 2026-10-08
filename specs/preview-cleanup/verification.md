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

## Inherited integration timing repair

Exact-head Foundation run 37810385352 failed at
`tests/integration/inquiry.test.ts:164`: two concurrent callers returned `accepted`
where the test expected exactly one. This did not establish two provider sends: the
subsequent send-count assertion had not run. The test and notification implementation
were byte-for-byte unchanged from develop 5f1669e. `claimSend` correctly returns an
already terminal status without sending, so an immediate fake response could finish
before the second caller read the row. The earlier local aggregate passed under a
different schedule; the remote failure was not retried or hidden.

The fixture now holds the first fake provider response while the second caller observes
the active sending lease. It releases the response in finally and retains the exact
one-accepted-result, two-total-provider-calls (including the initial failed attempt),
frozen payload/key, durable state/attempts, privacy and cutoff assertions. It also
explicitly checks the overlapping caller sees `sending`. No notification/application
code, timeout, retry setting, actual email or provider configuration is changed.

All five selected enquiry integrations passed after the barrier repair. The final full
local `npm run verify` then passed: 34 unit, 32 PostgreSQL integration, 35 Python, 4 hook,
12 release, **85 cleanup**, 1 built-dependency and **21 browser tests**, with static,
generated-file and production-build checks. Logs: `/tmp/lunia-cleanup-inquiry-regression.log`
and `/tmp/lunia-cleanup-final-verify.log`. No retries were added. This final source checkpoint
is ready for fresh exact-head CI; the earlier failed run remains evidence of the timing bug.

## Recovered PR and production executor completion

The replacement executor recovered and adopted existing PR47/issue46 at d8ea495 rather
than creating duplicate work. Original exact-head Foundation 37811527106 and Hook
37811451542 both passed; Vercel status was successful. PR45 and develop remote heads were
rechecked and unchanged. The recovered adapter refused DELETE unconditionally, so it was
insufficient for the requested automatic cleanup even though its tests passed.

The follow-up implements the supported Vercel HTTP DELETE path and connects apply mode to
the execution controller. Committed policy stays disabled, with no native project IDs or
closure cutoff. Apply also needs approved exact default SHA and complete native policy.
Hourly reconciliation handles displaced pending Actions events, late ref removal and builds.
The Git-ref-absent restriction remains. Automatic setup-node package caching is explicitly off.

Additional safeguards: immutable deployment repository ID; final Git ownership reread after
provider reads; project-target and alias blocking; verified absence after each DELETE receipt;
read-only Neon project/organization/full-name/source/immutable-branch validation; default,
protected and dependent Neon branch denial; retained/missing/unknown native results; sanitized
batch failure progress. No direct Neon or alias mutation exists. All assigned aliases block,
including normal branch aliases: unattended eligibility of existing aliased previews remains
an operational limitation, not a claim established by tests.

The real production adapter/controller and CLI event route were tested with injected fake
HTTP, synthetic approval config and synthetic tokens. No cleanup test makes a network request.
The focused suite now passes **114 tests**, including native pagination/late cleanup, project
mismatch, malformed inventory, permission denial, lost responses, DELETE 404/mismatched receipt,
read-to-write reopen/ref reuse and missed event reconciliation. The native naming and cleanup
sequence were independently checked against Neon's official documentation source on GitHub;
its primary site served a content type unsupported by the browsing tool.

Full local `npm run verify` passed in this replacement executor on 2026-10-08: **34 unit,
32 PostgreSQL integration, 35 Python, 4 hook, 12 release, 106 cleanup, 1 built-dependency,
21 browser tests**, production build and static/generated checks. Eight further cleanup cases
and post-delete confirmation/failed-planning handling were then added; all **114 cleanup tests**
passed. The final `npm run check` rechecks all static/unit/tooling stages on this code. Log:
`/tmp/lunia-cleanup-executor-verify.log`; focused log `/tmp/lunia-cleanup-focused.log`.
No application code, dependency or inherited test assertions were changed in this follow-up.
Final exact-head CI/preview results are recorded in PR47's body after publication. Provider
permissions, actual native cleanup/quota release, alias eligibility and activation are untested.

The first final `npm run check` invocation omitted the synthetic `PAYLOAD_SECRET` that
was present in the successful full aggregate. The unchanged privacy-signing unit test
failed with an undefined HMAC key (33 other unit tests passed); this was an executor
command setup error. The final check was rerun with the same explicit synthetic environment
as CI/full verification. No test or application code was changed to suppress the failure.
Original failed log: `/tmp/lunia-cleanup-final-check.log`; corrected command log:
`/tmp/lunia-cleanup-final-check-configured.log`.

Final fail-closed review additionally found that a malformed peer PR without a head ref or
repository ID could evade shared-branch detection, and a malformed project-target object
could evade retained-target detection. These now block before any DELETE. Four regression
cases bring the cleanup suite to **118 passing tests**; final static/unit/tooling checks
were rerun. No provider access or application code change was involved.
