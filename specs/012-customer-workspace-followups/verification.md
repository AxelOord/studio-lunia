# Verification and activation boundary

Related issues: [#35](https://github.com/AxelOord/studio-lunia/issues/35),
[#25](https://github.com/AxelOord/studio-lunia/issues/25).

The implementation is a private, simulation-only workflow. No real incoming route,
automatic scheduled sender, new credential, provider permission or paid plan is enabled.

Local focused verification passed: 2 domain/signature unit cases, 14 PostgreSQL follow-up
cases, additive follow-up migration up/down/up preservation, and 2 complete Playwright
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
