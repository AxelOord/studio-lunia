# Studio visitor instrumentation — verification

Base: PR42 `8aa1c1bf2948a023d64899576ee779072f7d2066`. Remote base/develop were rechecked
before publication. This branch does not modify the parallel experiment branch or taxonomy.

## Local behavior evidence

- `npm run test:unit -- tests/studio-measurement.test.ts tests/inquiry.test.ts`: 11 passed.
  Studio payloads have stable, distinct session/day/stage keys and exact bounded properties;
  malformed inputs and absent configuration/session are rejected. Bespoke payloads are preserved.
- `npm run test:integration -- tests/integration/studio-measurement.test.ts`: 5 passed.
  Real owned PostgreSQL tests cover concurrent claims, separate days, ambiguous delivery,
  durable immediate/manual reservations, new-session receipt retries, cancellation, no consent,
  explicit withdrawal permission, no backfill, validation/conflicts and optional claim failure.
  Independent pool reads prove the booking commit exists before provider invocation. Provider
  transport is injected and never calls an external service.
- Focused real Chromium run: 4 passed. Current visible exposure after opt-in is captured while
  the earlier slot selection stays absent. Repeated choices emit once; a lost response after the
  actual booking commit retries the same identity. Failed withdrawal cancels the queued step
  and sends `analyticsAllowed: false` with the booking. A delayed privacy read cannot restore
  an older consent choice. Real HTTP rejects forged completions, private days, unavailable
  selections, malformed IDs and foreign origins. Server providers remain disabled; only the
  browser readiness flag is simulated.
- Full `npm run verify`: passed on the frozen application/test sources: 47 unit, 94 PostgreSQL
  integration, 46 Chromium, 35 Python, 4 hook, 12 release and 1 built-dependency test, plus
  static/generated checks and production build. Source checksums matched before and after.

The first aggregate reached 47 unit, 94 integration, 35 Python, 4 hook, 12 release and 1 built
check plus production build, then 43/46 browser cases passed. Three new cases had ambiguous
locators: the inherited page has two h1 elements and Next adds its own alert region. Tests now
select the exact studio title and privacy region. The first failure log/screenshots/traces were
retained locally before rerunning. No product assertion, test timeout, retry or rate limit was
weakened. The focused corrected run passed all four cases. A subsequent aggregate exposed a test/build
wording mismatch introduced during an in-progress label review. Its trace was retained; the
final files were then frozen for a clean aggregate rerun.

## Visual inspection

Five actual desktop (1280 wide) and mobile (390 × 844 viewport) Chromium screenshots were opened
and inspected. The studio offer, retained retry form, confirmed receipt and failed-withdrawal
notice stay readable and within the viewport. The mobile report explicitly says studio reporting
is not connected and does not fabricate visitor counts. Error and receipt focus are asserted. This is
local synthetic evidence, not hosted acceptance or a full accessibility audit. The existing
multiple-h1/content hierarchy and decorative arrow font fallback can be reviewed under #43.

- [Desktop consented journey](evidence/studio-measurement-desktop.png)
- [Mobile retry with retained details](evidence/studio-measurement-retry-mobile.png)
- [Mobile saved receipt](evidence/studio-measurement-receipt-mobile.png)
- [Mobile failed withdrawal / collection paused](evidence/studio-measurement-withdrawal-mobile.png)
- [Mobile unavailable studio reporting](evidence/studio-reporting-unavailable-mobile.png)

## Review and ticket audit

Reviewed the React changes for stable callback/effect dependencies, observer cleanup, type-only
server imports, explicit consent readiness and retained form/error behavior. The transport review
confirmed the existing bespoke event list/signatures/payloads are unchanged. Studio uses a separate
builder and the shared at-most-once EU delivery function. No migration or dependency change.

Inspected issue #28/comments, PR42/comments and current repository issues. Reschedule/cancel is
already in #27; empty/error recovery is covered by #9, #26, #27, #28, #33 and #35. No duplicate
of those tickets was added. The missing public keyboard/mobile accessibility follow-up is
[#43](https://github.com/AxelOord/studio-lunia/issues/43), in the existing simple format. Staff
accessibility remains #35 and hosted CMS/mobile verification remains #17.

## Remaining gates

Exact published SHA, draft PR, terminal CI and the normal automatic preview result belong in
the PR conversation/checkpoint. Neon was already verified at 10/10 branches; no provisioning
retry, deletion or upgrade is authorized. Local verification must not be called hosted-tested.

PostHog capture remains disabled by default; the studio aggregate reader is not connected and
the existing bespoke reader remains disabled. Reader integration, exact project/access approval,
secure configuration and hosted consent/no-consent/withdrawal acceptance remain separate work.
No real customer messages, payments, provider credentials, security settings, production site,
merge, or experiment activation were changed. Issue #28 remains open.
