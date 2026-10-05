# Verification and activation boundary

Related issues: [#35](https://github.com/AxelOord/studio-lunia/issues/35),
[#25](https://github.com/AxelOord/studio-lunia/issues/25).

The implementation is a private, simulation-only workflow. No real incoming route,
automatic scheduled sender, new credential, provider permission or paid plan is enabled.

Local focused verification passed: 2 domain/signature unit cases, 20 PostgreSQL follow-up
cases, additive follow-up migration up/down/up preservation, and 5 complete Playwright
journeys. The historical customer migration test now identifies its starting migration by
name, preserving its original assertions as later additive migrations are introduced.

Screenshots inspected at desktop and 390px: `workspace-inbox-desktop.png`,
`workspace-customer-desktop.png`, `workspace-customer-mobile.png` and
`workspace-queue-mobile.png` in `test-results/`. They show actual authenticated native
CMS views with synthetic customer data. Functional tests assert labels, keyboard focus,
visible errors, exact email content, no overflow, no console errors and no analytics calls.
Full aggregate verification, exact-head CI, independent review and automatic hosted preview
are recorded with the PR once completed; focused tests alone do not establish those gates.

## Decisions required before live activation

- Approve the real message wording, purposes, elapsed/business-day rules and timezone.
  There are no active suggested rules or inferred marketing permissions.
- Select and approve the dedicated receiving address/domain and narrow webhook/content
  retrieval access. The send-only sandbox credential cannot establish receiving capability.
- Verify the actual receiving route and authenticated content retrieval, exact reply
  correlation, unknown-match review, duplicate/reordered events and opt-out policy.
- Select an approved runner and verify its timing tolerance and hosting limits. Current
  Vercel Hobby cron documentation describes daily scheduling with hour-level precision;
  this batch enables no cron, scheduler or upgrade. Manual simulation proves no live SLA.
- Separately verify real provider idempotency, retry windows, cancellation handoff and
  outage recovery before replacing the no-network simulation transport.

Resend sandbox limitations remain unchanged. A private customer draft cannot send to a
visitor, and a successful simulation never appears as accepted, delivered or read.
These remaining live acceptance conditions keep #25 open after implementation.

## Independent review corrections

Five P2 findings on the first PR #38 head were reproduced before correction:

- Rule-generated plan edits dropped their original rule revision and incorrectly became
  blocked. The snapshot now retains its original revision; an actually changed/reapproved
  rule still blocks the old plan.
- Real delivery adapter events did not immediately refresh follow-up state. The hook now
  uses the existing delivery-event allowlist. Bounce, failed, delayed and suppressed
  events immediately block plans, cancel obsolete jobs and update the attention view;
  duplicate events preserve the revision.
- Queue links opened the newest enquiry for a customer with multiple requests. Links now
  carry the plan ID; the server resolves its own enquiry and explicitly includes selected
  records beyond the recent list limits, with customer-scoped access checks.
- Delayed saved-email reads could reopen a closed preview or replace a newer selection.
  A request generation invalidates older responses on selection, close and unmount.
- Workspace refresh retained a stale editor snapshot after a 409. The editor now keeps
  draft fields independently from the refreshed plan and its base revision. Reapplying
  requires an explicit acknowledgement and another exact-message review. A newly terminal
  plan keeps the draft visible but cannot be saved.

Reproduction evidence: five failing backend cases before the first two fixes, plus three
failing browser cases against the previous compiled build. The fixed backend has 20 passing
follow-up integration cases, including cross-customer deep-link isolation. Browser regressions
cover multiple enquiries, controlled delayed reads, concurrent edits, 409 recovery and
cancellation during editing. Full fixed-head results are recorded in the PR checkpoint.

Local aggregate `npm run verify` passed after the review fixes: 36 unit, 53 integration,
35 Python, 4 hook, 12 release, 1 built-dependency and 26 browser tests, plus static checks,
production build and generated-file consistency. New conflict desktop/mobile screenshots
show preserved drafts, explicit reapply, disabled save before fresh review and successful
recovery. Hosted authenticated workspace controls remain unverified without owner access.
