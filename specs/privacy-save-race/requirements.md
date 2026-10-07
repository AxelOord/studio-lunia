# Privacy save race — bugfix

Workflow: bugfix
Status: ready

## Reproduction and actual behavior

At combined PR #45 head b687d7e, Tab A begins granting analytics/experiment consent.
Hold its successful POST response. Tab B declines optional consent and broadcasts a pause.
Releasing A's older response unconditionally reapplies its granted Choice; browser Set-Cookie
ordering can also restore a granted preference/identity after B's response. The existing
initial-GET guard cannot protect a POST. Independent rereview reproduced false permissions
after withdrawal becoming true after the old response. The new browser case also checks
that a withdrawal cannot depart with the pre-grant cookie jar while the first response is held.

## Acceptance criteria

### R-1: Ordered privacy choices and stale-response denial

WHEN privacy reads/saves overlap across tabs, the system SHALL serialize each complete request
and response before the next privacy request. A save response from an older consent generation
SHALL NOT restore local permissions, draft controls, tracking or campaign synchronization.
Every explicit saved choice, including a queued withdrawal, SHALL reach the ordered write queue.
Check: two real tabs with a held grant response; withdrawal waits and stale local state stays denied.

### R-2: Cookies and server revocation

WHEN withdrawal follows an in-flight grant, the withdrawal request SHALL include the newly
issued cookie, revoke that experiment identity, delete optional cookies and persist denied
preferences. Replaying the older signed cookie set SHALL fail assignment. Reload SHALL retain
denial; a later explicit grant SHALL create a fresh usable identity with stable repeat visits.
Check: real HTTP cookie headers, final cookie jar/preferences, database tombstone, stale-cookie
assignment rejection, fresh grant and repeat assignment/exposure counts.

### P-1: Preserve both privacy contracts and essential flows

WHEN coordination fails or is unavailable, optional collection SHALL CONTINUE TO remain paused
and no uncoordinated privacy write may silently succeed. Enquiry/booking forms remain usable.
The studio queue, independent experiment consent, stale-GET denial, no-backfill behavior,
server-only completion and retry/deduplication contracts SHALL remain intact.
Check: unsupported-coordination browser case and full inherited combined suite.

## Scope and open questions

Client privacy request coordination and focused regressions on the existing PR #45 branch only.
No schema/access workaround, provider activation, credential change, new branch, PR merge or
old-site change. Live baseline/power/stopping, retention/consent review, approval and hosted
acceptance remain unresolved. Failed persistence is shown as unsaved; it is never called a
successful withdrawal. This protocol coordinates this application's same-origin tabs, not
arbitrary external clients or obsolete application versions.
