# Verification evidence

Local environment: Node 24.19.0, npm 11.9.0, Payload 4.0.0-canary.37,
Next 16.3.8 and PostgreSQL 17; synthetic records and fake provider transport only.
Tickets #10/#23/#24 and their comments were re-read on 2026-10-05; no new comments.
Develop was re-fetched at 7f3f2264e927c47d64362ddfe2b2b8fb04733303.

- `npm run check`: 31 JS unit tests, 35 Python workflow tests, 12 release tests;
  specification, ESLint and TypeScript checks pass.
- `npm run test:integration`: 28 pass, including nine new record/migration scenarios.
  Migration test creates a fresh local database, installs the old schema, inserts legacy
  leads, migrates and compares every original field/date/attribution. Matching emails keep
  separate contacts; migration rerun does not duplicate history. Fresh native-preview
  bootstrap also passes and preserves editor changes.
- Sender/records tests exercise concurrent idempotent commands, conflicting key reuse,
  validation, immutable snapshots, correction reversal/replacement, invalid refunds,
  template approval clearing, safe recipient enforcement, provider rejection/timeout,
  bounded identical-payload retries, early callbacks, concurrent duplicate callbacks,
  out-of-order terminal facts, unknown account events and legacy snapshot gaps.
- Unit fixtures verify the official Svix raw-body signature, tampered/expired/wrong-version
  input, minimal parsed facts and order-independent status reduction. No external webhook
  registration or hosted delivery acceptance is claimed.
- `npm run build` and `npm run format:check` pass. Generated types/import map are included.
  Upload dependency trace, private-upload browser metadata and showcase checks pass.
- New browser scenarios cover proposal/confirmation/manual payment, customer timeline and
  staff replies, live template preview without sending, frozen private draft rendering,
  desktop/mobile layout, denied anonymous access/origin and disabled webhook endpoint.
  Screenshots in `test-results/customer-*.png` were visually inspected.

Browser QA found and corrected select names that included their option text, incorrect
old Payload theme tokens and stale duplicate native booking status fields. Tests now assert
explicit accessible names and actual panel border styling. Private JSON snapshots use an
inert local display instead of loading a remote code editor. Screenshots scroll the email
iframe into view before capture so its rendered content is visible. A legacy block-editor
insertion timeout occurred during concurrent test load; the final full browser rerun without
other browser jobs passes all 18 tests in 44.8 seconds. No timeout allowance was raised.

Remote CI, automatic full-CMS preview, hosted staff journey and GitHub Development links
remain pending until the draft PR is available. Live Resend callbacks remain disabled because
a narrowly approved ingress is unavailable; customer mail activation remains separate.
