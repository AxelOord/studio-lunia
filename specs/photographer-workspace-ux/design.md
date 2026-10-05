# Photographer workspace UX — design

## Approach and boundaries

Replace the long all-at-once customer page with persistent, labelled task sections.
Use simple native buttons with pressed state and hidden regions rather than a custom
keyboard tab widget. Existing operations, revision checks, request generations and
idempotency stay intact. Keep native Payload navigation available for advanced records.
No schema change, new dependencies or sending behavior changes.

## Behavior mapping

R-1: Counted one-click inbox filters with parameter-bound search, stable server priority
and clear row actions. Counts describe the current search across all pages.
R-2: Compact header and request selector, persistent reply/booking/follow-up/history
regions, current-section navigation and contact preferences in a secondary disclosure.
R-3: One shared validated server queue query for SSR and API pagination. Move the
follow-up editor into its task section; preserve exact plan links and conflict drafts.
R-4: Readable native-theme typography, restrained primary/secondary hierarchy, touch
controls and wrapping. Short always-visible test-mode statement expands into full limits.
Simulation input lives in an explicitly labelled disclosure, not ahead of real history.

## Tradeoffs and verification

A drawer/dialog would add focus trapping and mobile height constraints. Persistent
sections provide focused work without discarding drafts or obscuring customer context.
Keep the backend state model and raw collection escape routes. Before/after local
synthetic screenshots cover both widths; existing complete workflow and race/conflict
browser tests are adapted to the intentional navigation. Add meaningful filter/order
integration coverage. Run the aggregate verify command and exact-head CI.

## Baseline audit

Actual local authenticated capture on 2026-10-05, 1440×1000 and 390×844, baseline
8a8e295. Six synthetic customers only. Files are in /tmp/lunia-admin-audit; they are
local evidence, not hosted assets. Each numbered image was opened and inspected.

1. Inbox (01): needs work. New enquiries fall below closed/waiting customers; tall rows
   and select-plus-submit filters make triage slow. Fix ordering and direct filters.
2. Navigation (02): needs work. Task links duplicate in the native menu and lack current
   indication; raw collections compete with daily tasks. Keep advanced navigation but
   clearly distinguish the current workspace task.
3. Customer overview (03, 10 mobile): high friction. Stop-all control appears before the
   request. At 390px, the first task starts below the initial viewport. Compact context,
   move preferences to disclosure and put task selection before forms.
4. Reply review (04): functional but crowded. Full email expands inside a narrow column
   while the other column becomes empty. Use the available task width.
5. Proposal (05): needs work. Proposal and draft can both remain expanded while staff
   scroll through simulated reply/history. Give booking its own persistent section.
6. Follow-up editor (06): high friction. Editing appears after both long columns; captured
   viewport shows only its heading at the bottom. Place editing before plans in its task.
7. Mobile history (07): readable text but long path to booking. Hide unrelated sections,
   preserve history and make simulation input optional.
8. Queue (08 mobile, 09 desktop): needs work. No state filters; run-simulation control
   precedes review; blocked cause exists but customer's name is subordinate to subject.
   Make customer/status/review the primary scan order and simulation secondary.

Accessibility risks to verify separately: visible focus/current state, task change focus,
44px controls, no horizontal overflow, exact preview readable at both widths. Baseline
screenshots do not establish compliance or hosted authentication behavior.

## Before/after evidence

Actual local production builds, authenticated synthetic data, same viewport sizes.
The fixture was reset to the same six cases before final captures; dates reflect capture
time. Desktop is 1440×1000, mobile 390×844. No real customer or provider data is shown.

| Journey                 | Before                                        | After                                                      |
| ----------------------- | --------------------------------------------- | ---------------------------------------------------------- |
| Inbox triage            | [Before](evidence/inbox-before.png)           | [After](evidence/inbox-after.png)                          |
| Customer context        | [Before](evidence/customer-before.png)        | [After](evidence/customer-after.png)                       |
| Mobile customer         | [Before](evidence/customer-mobile-before.png) | [After](evidence/customer-mobile-after.png)                |
| Mobile follow-up review | [Before](evidence/queue-mobile-before.png)    | [After, attention filter](evidence/queue-mobile-after.png) |

Review observations: new enquiries precede closed customers; task sections replace the
long two-column page; selected customer/request remains visible while booking or planning;
exact editor receives focus and cancellation returns focus to its trigger. Mobile has no
horizontal overflow. Browser regression preserves unsaved proposal and plan wording across
section changes, delayed-email protection, deep-plan scope and explicit conflict recovery.
The initial added queue test matched Next's separate route-announcer alert; scoping its
assertion to the workspace fixed the test without changing behavior. Screenshot review
found and corrected low selected-filter contrast during hover.

Aggregate verification also reproduced a shared-fixture limit failure: after public
inquiry boundary tests, the extra admin fixture received HTTP 429 from the unchanged
20-attempt local IP bucket. Admin fixtures now call the existing submitInquiry function
in a short-lived process constrained to the runner-owned loopback lunia_test database
and synthetic example.test identities. It clears provider configuration, closes its
Payload/pool handles, and never changes or resets public rate limits. Public inquiry
HTTP/throttle tests remain unchanged. This removes order dependence rather than retrying
the failed run or relaxing the application limit.

The cached getPayload variant did not exit in the browser fixture subprocess. Using
an uncached BasePayload instance, with type generation disabled for fixture creation,
exits cleanly and matches the integration fixture pattern. The focused queue/search
case then passed in 9.1 seconds; its helper is bounded and accepts no stdin. The final
aggregate run must still complete after this fixture change.
