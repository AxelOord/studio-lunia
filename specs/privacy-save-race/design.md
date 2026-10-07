# Privacy save race — design

## Approach and boundaries

A generation check prevents stale React/ref updates but cannot undo Set-Cookie already processed
by the browser. Use one exclusive named Web Lock around privacy GET/POST through response-body
consumption. GET participates because it can renew the measurement cookie. An in-flight consent
POST is not aborted: let its response/cookies settle before a queued withdrawal sends its request.
The withdrawal then sees the issued experiment cookie and uses the existing revocation tombstone;
its denied preference and cookie deletions arrive last. No new server table or privilege is needed.

Every explicit save is serialized; do not discard a queued withdrawal just because another
pause message advances its generation. Only response application is conditional on the captured
save generation. A stale response cannot update current/visible/draft choices, close the newer
UI or run campaign synchronization. Broadcast pause also resets draft controls. Fresh deliberate
reconsent uses a new generation after withdrawal and the normal server-issued new identity.

[Web Locks](https://www.w3.org/TR/web-locks/) coordinate same-origin contexts until the callback
promise settles. Without that capability, reads/saves fail closed using the existing paused/error
state; there is no unsafe parallel-write fallback. Privacy reads respect their existing abort and
generation guards. Essential forms continue using explicit denied submission permissions.

## Behavior mapping

R-1: withPrivacyLock in PrivacyControls, save-generation guard, reset draft on broadcast.
R-2: ordered real response/cookie flow feeds existing saveExperimentConsent revocation. Test both
canonical denied preferences and replay of the complete older signed cookie set against the server.
P-1: real two-tab tests plus unsupported capability, inherited studio/experiment flows and full verify.

## Tradeoffs and verification

A queued withdrawal pauses the UI immediately but is not claimed persisted until the older request
and its own response settle. A hung/failed request cannot be bypassed with concurrent consent writes.
Transport failure remains an honest unsaved-choice error; there is no background grant replay.
Campaign/measurement requests retain their generation/abort checks and cannot restore the consent
preference; rejected stale saves never start campaign sync. No stronger cross-device consent or
cleanup of previously delivered measurement is claimed.

The browser regression holds a real successful grant, queues another tab's decline, checks no
early withdrawal HTTP request, releases the grant, then checks request cookies, final cookies,
server preferences/revocation and valid fresh reconsent. Existing delayed-GET cases now release
the held read before awaiting save completion, preserving their denial assertions while respecting
ordered requests. No assertion is weakened and no retry or timeout is increased.
