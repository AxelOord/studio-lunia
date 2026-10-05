# Implementation review and evidence

Base: develop `4fed0109a758b47ccb4e4305d3d9d93be310ac78`, fetched again before PR.
Branch: `feat/inquiry-attribution-funnel`. Latest #9/#11/#12 issue text and comments
were read before implementation; no comments changed the acceptance criteria.

## Implemented

- R-1/R-2: published-service choices, accessible responsive enquiry form, bounded input,
  private Payload leads, unique idempotency key and content-conflict handling, on-screen
  receipt and manual follow-up status. No browser persistence of contact/form content.
- R-2: photographer-only sandbox notification, durable pending/failed/accepted states,
  atomic bounded retries and explicit manual fallback. Accepted means provider acceptance,
  not verified delivery. Visitor emails are never sent in preview.
- R-3/R-4: separate explicit opt-ins, signed HttpOnly preference/campaign/session cookies,
  first/last attribution, fixed expiry, allowlisted identifiers, no-consent and withdrawal.
  Stable lead ID plus versioned immutable snapshot supports future booking/revenue linkage.
- R-5: server-built EU capture payload with fixed events and opaque identifiers, no PII,
  campaign strings, forwarded visitor IP, replay, SDK, automatic properties or person profiles.
  PostgreSQL duplicate claims; provider errors cannot invalidate an enquiry. Unconfigured
  integration is disabled. The local provider boundary is simulated, not hosted proof.

## Verification

Local Node 24.19.0, PostgreSQL 17 in the repository's Docker service, synthetic data only.

- `npm run check`: specs, lint, TypeScript, 27 Node tests and 35 Python workflow tests pass.
- `npm run test:integration`: 19 tests pass, including five enquiry/measurement cases.
- `npm run build`: production build passes with the exact pinned Payload/Next packages.
- Full browser suite: 15 tests pass, including five new enquiry/privacy journeys covering validation, focus, mobile overflow,
  network retry, consent, attribution, concurrency blocked storage, throttling, forged completion rejection and edit/read access boundaries.
- `npm run format:check`, `npm run test:upload-trace`, `npm run test:upload-metadata` and `git diff --check` pass.
- [Desktop errors](../../docs/evidence/inquiry/inquiry-desktop-errors.png),
  [mobile retry](../../docs/evidence/inquiry/inquiry-mobile-retry.png),
  [mobile confirmation](../../docs/evidence/inquiry/inquiry-mobile-confirmation.png) inspected:
  readable labels/errors, retained fields, visible actions, no horizontal overflow.

Browser QA caught and fixed two runtime issues before proposing the change: Next's local
URL hostname differed from the incoming host, and a module-local Symbol capability was
not shared across compiled route/config chunks. Same-origin checks now use the actual
Host with the request scheme, and the in-process capability uses Symbol.for (not forgeable
through JSON). HTTP/browser preservation tests cover both paths. Tampered non-ASCII MACs
are rejected before constant-time byte comparison.

## Provider and acceptance limits

PostHog account/project/access/terms have not been provisioned or approved in this task.
Activation and hosted funnel/replay/property verification remain blocked; see
[secure handoff](../../docs/inquiries-and-measurement.md#posthog-approval-and-secure-handoff).
No production/legal-policy readiness claim. Provider mailbox delivery is not established
by fake-provider tests. Full CMS preview verification and exact-head CI are recorded in
PR evidence, not inferred from a local build.

No booking, live calendar, payments, Google Ads feedback, experiment, CRM timeline or
scheduled follow-up engine was added. The future roadmap must reuse the operational
lead ID without transmitting contact information to analytics. No workflow changes.
Completed issues remain none while provider acceptance is incomplete; issues stay open.
