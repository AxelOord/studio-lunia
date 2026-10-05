# Coding standards

Write code another developer can follow without reconstructing hidden assumptions.
Use clear names, direct control flow and small functions with a concrete purpose.
Keep changes tied to a ticket. Add an abstraction only when it removes real duplication
or makes a boundary clearer; avoid extra layers and arbitrary complexity limits.

- **Types and async work:** keep strict TypeScript. Use generated Payload types and
  explicit types at API boundaries. Await or return promises; use `void` only for
  deliberately handled background work. ESLint rejects floating promises and raw
  console logging in application code, explicit `any` and unsafe TypeScript comments.
- **UI and server code:** UI modules use authenticated HTTP actions and shared pure
  types/renderers. Lint rejects database, provider and private server imports in the
  admin/components directories. Put server-rendered view modules in `*.server.tsx`;
  do not mark them `use client` or import them into client code. Next's build remains
  the final bundle check. A filename alone is not an access-control boundary.
- **Requests and permissions:** validate untrusted input with the existing bounded
  request/domain helpers, authenticate before private reads, and enforce collection
  access. User Local API calls use `overrideAccess: false` and the actual user.
  Keep deliberately privileged bootstrap/system operations explicit. Reuse shared
  authorization and error helpers; never expose provider errors, secrets or contact
  data in logs or analytics.
- **Writes and failures:** preserve idempotency, transaction boundaries and immutable
  snapshots. Show actionable errors and clear recovery paths. Do not swallow failures
  or add a retry without proving duplicate/cancellation behavior.
- **Tests and review:** tests read as behavior examples: given owned fixtures, perform
  an action and assert the observable outcome and denial paths. Test each case alone.
  Keep meaningful security coverage. Review correctness, readability and maintenance
  cost independently; passing checks do not replace review.

`npm run verify` enforces lint/types/formatting and runs the application, integration,
browser and tooling/security checks. CI uses the same named stages. Generated types,
import maps and migrations retain their upstream formatting and generation workflow.
