# Implementation review and evidence

Base: initially develop `4fed0109a758b47ccb4e4305d3d9d93be310ac78`; updated to
`29425ec115769563c6ca55800f6c5ef1237fae15` by merging develop during verification.
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

- `npm run check`: specs, lint, TypeScript, 27 Node tests, 35 Python workflow tests and
  12 inherited release-automation tests pass.
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

## Hosted checkpoint

Draft [PR #29](https://github.com/AxelOord/studio-lunia/pull/29) targets verified develop.
GitHub timelines for all three issues contain cross-reference events to PR29; no closing
keywords or status transitions were used. This proves related references, not a native
Development-sidebar link (the connector exposes no such mutation).

Automatic deployment `dpl_B8yWTHAQaAC2WQoTMP5CMo4gGAuG` reached READY at the
final application commit `a266b56afd588f54916ea483ece91e9d9caa70bc` on the approved
studio-lunia project `prj_RiVoPaLLyHgqAwR2Hivx3X2hRTAM`.
[Immutable URL](https://studio-lunia-5f353uf4j-axeloords-projects.vercel.app) and
[branch URL](https://studio-lunia-git-feat-inquiry-attribu-9f811b-axeloords-projects.vercel.app)
serve the form with seeded published service choices. `/admin/login` serves Payload;
`/api/enquiries` denies anonymous reads (403); `/api/privacy` returns all choices false
and `configured:false`. Build used `build:preview`, so it did not fall back to showcase.
Direct executor HTTP/browser access is blocked by the network proxy (CONNECT 403), even
with authorized network escalation; connector GET verification succeeds. Authenticated
hosted submission/CMS inspection and mailbox delivery are therefore still unverified.

First exact-head CI passed hooks, aggregate checks, fresh migrations, 19 integration
tests and build, then caught a browser-test race: the measurement journey selected a
service before the asynchronous consent save completed. Correct behavior withheld that
pre-consent view. The test now waits for the visible saved state before the consented
journey. No unrelated base page-management failure occurred. Updated exact-head results
and deployment are maintained in PR29 to avoid a commit/SHA evidence loop.

Final application commit `a266b56afd588f54916ea483ece91e9d9caa70bc` passed
[Foundation checks](https://github.com/AxelOord/studio-lunia/actions/runs/37332558356)
and [Hook portability](https://github.com/AxelOord/studio-lunia/actions/runs/37332558721).
Foundation's `verify` job passed every step: commit/completion policy, generated files,
aggregate/format checks, fresh migrations and seed, integration, production build, all
browser tests, upload checks and showcase. Publication/status mutation jobs were skipped
as expected for this draft feature PR. Documentation-only evidence follow-ups get their
own exact-head checks; see PR29 for the final branch SHA and run links.

The coordinating parent is handling authenticated hosted browser/CMS/mailbox acceptance
and native GitHub Development links. Their outcomes are not assumed here. T-4 remains open
until that evidence is available, and #12 also retains its separate provider activation gate.

Develop advanced to `29425ec` during verification; it was merged into the feature branch
without changing the inherited release-workflow files. All local aggregate checks also
passed on that base. A final privacy review found that confirming an old idempotency key
after granting consent could create a late completion. Submission now reports whether
it actually created the record, and only that winning create emits completion. Concurrent
and late-consent retry integration assertions preserve one lead and one eligible conversion.
