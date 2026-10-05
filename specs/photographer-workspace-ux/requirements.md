# Photographer workspace UX — requirements

Workflow: requirements-first
Status: ready

## Goal and scope

Improve the daily photographer workflow requested by the owner on 2026-10-05.
Related issues: [#35](https://github.com/AxelOord/studio-lunia/issues/35),
[#25](https://github.com/AxelOord/studio-lunia/issues/25); current bodies and empty
comment lists rechecked on 2026-10-05. Build on reviewed PR #38 at 8a8e295.
Use existing authenticated records and simulation-only operations. Public branding,
landing pages, live mail, new providers, production and booking calendars are excluded.

## Acceptance criteria

### R-1: Prioritize daily work

WHEN staff open the inbox, the system SHALL expose direct, counted task filters,
prioritize new enquiries and attention cases, and show an understandable next action.
Search stays private and stale responses cannot replace newer results.
Check: mixed synthetic customers, empty search, filtered result and concurrent searches.

### R-2: Focus on one customer task

WHEN staff open a customer, the system SHALL show customer/request context and direct
sections for reply, booking, follow-ups and history without scrolling past unrelated forms.
Switching sections preserves unsaved work; a queue link opens its exact plan and enquiry.
Check: desktop/mobile full journey, retained draft and exact deep-link regression.

### R-3: Review follow-ups in context

WHEN staff manage a follow-up, the system SHALL place the editor beside its task context,
show status/reasons and provide server-paginated queue filters for attention, planned,
paused and finished work. Conflicting edits retain wording and require explicit refresh/review.
Check: queue filters, error recovery, revision conflict and terminal plan regression.

### R-4: Clear boundaries and accessible actions

WHEN staff use the workspace, the system SHALL distinguish primary actions, indicate
current navigation, preserve explicit no-delivery test mode, and keep test tools secondary.
Keyboard focus, labelled controls and 390px reflow remain usable. No analytics receive data.
Check: actual authenticated screenshots before/after, keyboard flow, mobile overflow,
late email response and no analytics regressions; this is not a WCAG conformance claim.

## Open questions

Owner's optional detailed UI feedback may refine priorities. Hosted authenticated visual
QA still requires the owner's session; local synthetic QA cannot prove it. Check preview
branch capacity before pushing; do not delete branches or purchase capacity.
