# Experiment groundwork — requirements

Workflow: requirements-first
Status: ready

## Goal and scope

Groundwork for [#14](https://github.com/AxelOord/studio-lunia/issues/14), dependent on PR #44
at ef8d28ed (including PR #42 at 8aa1c1bf). Issue read 2026-10-06; no comments. Owner authorized implementation
without further setup questions. No live launch, provider activation, sends, payments,
credentials or old-site changes. Issue remains open for agreed baseline/traffic and live acceptance.

## Acceptance criteria

### R-1: Bounded private authoring

Staff SHALL configure a named hypothesis, one published service landing, original/control
and alternate CTA copy, a fixed split, baseline/traffic rationale, minimum exposed browsers
per variant and planned duration. Default mode is simulation; live delivery is disabled by
default by an independent server flag. Configuration freezes after preparation, one live
experiment per landing is allowed, and stopped tests cannot restart or lose their content.
Check: anonymous writes/reads denied, invalid/draft eligibility rejected, concurrent edits constrained.

### R-2: Consent and eligibility

Visitors SHALL receive the original published CTA without explicit experiment consent.
Experiment consent is separate from PostHog and campaigns. An HttpOnly signed random browser
identifier lasts at most 30 days from grant, is never renewed by visits, and is removed on
withdrawal. Assignment is stable per experiment/browser across visits and concurrent calls.
No contact, campaign, URL query or fingerprint enters experiment storage. Private simulation
requires a current staff session and never changes live totals.
Check: grant/decline/withdraw/regrant, late responses, stale-cookie denial and repeated visits.

### R-3: Honest measurement

Only a visible assigned CTA SHALL count an exposure. Only a newly committed matching-service
enquiry within 30 days of that exposure SHALL count an outcome. Assignment, exposure and outcome
are deduplicated in PostgreSQL. Repeated requests and concurrent retries cannot add conversions;
unexposed, withdrawn, expired, stopped or mismatched visits cannot convert. No client outcome endpoint
for live traffic. Failure to measure never breaks enquiries; missing events are not replayed later.
Check: owned PostgreSQL races and actual browser enquiry, withdrawal and retries.

### R-4: Results and retention

A private responsive results view SHALL show assigned/exposed/converted counts and explicit
conversion denominators, per-variant uncertainty intervals, plan thresholds and sample limitations.
It SHALL never infer significance or a winner. Simulations are labelled. Stopping immediately
prevents new measurement. Chosen text can be copied into the landing page draft without
publishing or replacing unrelated page content.
Check: zero/small samples, access, desktop/mobile/keyboard, draft-copy preservation.

### R-5: Review evidence

The batch SHALL preserve existing tests, pass aggregate local verification, inspect actual
screenshots and publish a Conventional Commit draft PR with dependencies and honest issue status.
Record exact-head CI and one automatic preview outcome; do not retry Neon provisioning at 10/10.
Check: verification log, screenshots, exact SHA and remote outcome.

### R-6: Combined studio and experiment privacy

WHEN PR #44 is integrated on the existing experiment feature branch, the shared privacy
context SHALL preserve independent experiment consent and studio analytics readiness,
allowlisted event queuing, explicit submission permissions and cross-tab withdrawal.
A delayed initial privacy response SHALL never restore either permission after a newer
consent change. Consent grants SHALL not backfill prior studio selections or enquiries.
Existing studio claims/server-only completion and experiment assignment/outcome deduplication
SHALL continue to pass. Runtime/provider flags remain disabled; no schema or access workaround.
Check: combined cross-tab browser journey plus the complete inherited unit/integration/browser suite.

## Open questions

None for groundwork. A real baseline, power/sample plan, consent wording review and owner
launch approval remain future gates; numerical thresholds alone do not establish valid evidence.
