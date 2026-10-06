# Studio Lunia

A photography website foundation using Payload **4.0.0-canary.37**, Next.js **16.3.8**,
React **19.2.6**, PostgreSQL and Node **24.19.0**. This is a prerelease foundation for
review, not the live Lunia site. Studio-session booking is a synthetic prototype; payments, customer email delivery and advertising feedback are not enabled. Enquiries and optional first-party attribution are implemented; PostHog EU measurement stays off until separately approved and configured.

## Local development

```sh
npm ci
cp .env.example .env
# Set PAYLOAD_SECRET to a random 32+ character value.
# Set SEED_EMAIL and SEED_PASSWORD (16+ characters) for your local editor.
docker compose up -d
npm run db:migrate
npm run seed
npm run dev
```

Open http://localhost:3000 and /admin. The seed is idempotent and preserves existing
editors/content. First-user web registration is blocked; bootstrap only via the local
seed command. Never use the example database password outside local development.
Local Payload logs email instead of delivering it. Hosted previews use the approved
restricted mail adapter and a privately supplied default for new test accounts; see
[the full CMS preview runbook](docs/full-cms-preview-runbook.md).

`media/` persists between local app restarts but is untracked. PostgreSQL uses a named
Docker volume. Back up both together. Do not use either as Vercel filesystem storage.

## Verification

```sh
npm ci
docker compose up -d
npx playwright install chromium
npm run verify
```

This runs the same lint/types, unit, tooling/security, isolated PostgreSQL, build and
browser stages as CI. Tests create and remove their own local databases; they never use
hosted data or require provider credentials. Each integration case owns its fixtures.
See [testing and selected-test commands](docs/testing.md) and [coding standards](docs/coding-standards.md).
Screenshots, traces and reports are in ignored `test-results/` and `playwright-report/`.
Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium` when using system Chromium.

## Environment

| Variable                   | Purpose                                                              |
| -------------------------- | -------------------------------------------------------------------- |
| DATABASE_URL               | PostgreSQL connection, server-only; required in CMS mode             |
| PAYLOAD_SECRET             | Random 32+ character signing secret; server-only                     |
| NEXT_PUBLIC_SERVER_URL     | Documented local origin for future links; no secrets                 |
| SEED_EMAIL / SEED_PASSWORD | Local bootstrap/test account; never deployed                         |
| LUNIA_SHOWCASE             | Explicit sample-only preview mode; CMS/API/preview routes return 503 |

No secrets are committed. Automatic full CMS previews use native Neon branches, private preview Blob and restricted
Resend access. See docs/full-cms-preview-runbook.md for setup and hosted acceptance.
The earlier manual path remains documented in docs/hosted-cms-runbook.md. Vercel production builds
are blocked. See docs/vercel.md for separate preview setup.

## Structure and workflow

- `src/collections`: users, media, draftable pages and private enquiries.
- `src/blocks` and `src/components`: typed reusable page blocks and rendering.
- `src/lib/attribution.ts`: future outcome contracts; consent-aware campaign logic lives in src/lib/campaign.ts.
- `specs/001-payload-foundation`: requirements, design, tasks and evidence.
- `docs/architecture.md`: scope and follow-on specs.
- `docs/ai-tooling.md`: version-matched official AI resources and MCP decision.

Read AGENTS.md before working. Create a spec with `python3 scripts/specflow.py new <name>`.
The checker maps acceptance criteria to tasks but does not execute tests or prove evidence.
Use small feature branches targeting develop, draft PRs and explicit verification.
Master is reserved for reviewed releases. No automatic merging or production promotion.

## Commit workflow

`npm ci` installs fast staged formatting/lint checks and Conventional Commit validation.
Use subjects such as `feat(media): add image selection` or `fix: preserve draft images`.
Run `npm run test:hooks` for disposable-repository hook tests. CI checks new PR commits
and titles inside the existing `verify` job; Windows hooks have a portability check.
`.commit-policy.json` fixes the already-published history exemption; do not advance it.
CI/hosted/production/non-Git installs skip hooks. No branch protections are changed.
See [the workflow spec](specs/commit-workflow/requirements.md) and the gated
[release workflow](docs/release-automation.md). Hooks require Node24 and Git
for Windows on Windows; hook entrypoints use POSIX shell and LF line endings.

## Enquiries and optional measurement

Published service cards link to `/inquire`; no services or availability are invented.
The private Enquiries collection holds contact details, immutable attribution and manual
follow-up state. Preview visitors receive an on-screen receipt only. Notifications go
solely to the configured preview editor; failed attempts stay visible with bounded retries.
Local notifications are explicitly disabled. See [the batch runbook](docs/inquiries-and-measurement.md).

No optional tracking runs by default. Separate choices control campaign storage and
measurement. No browser analytics SDK or replay is installed. The PostHog EU capture API
is disabled until the exact project, access and terms are approved and provider variables
are configured securely. Local fake-provider tests do not prove hosted measurement.

## Private customer records

Staff can link contacts/enquiries, record booking proposals and status changes, and maintain
manual payment/refund history. Approved email templates provide desktop/mobile preview and
immutable private drafts; sandbox tests use synthetic content and the own-editor recipient.
Customer mail and live delivery callbacks remain gated. See
[the records and email runbook](docs/customer-records-and-email.md).

The admin dashboard opens the enquiry inbox, with counted task filters and private search.
Each customer has separate enquiry/reply, booking, follow-up and history sections; switching
sections keeps drafts. The follow-up queue supports status filters. Simulation tools and
customer follow-up preferences are secondary disclosures. All customer sending and real
incoming replies remain off. See the [workspace UX audit and evidence](specs/photographer-workspace-ux/design.md).

## Conversion overview

The private workspace reports separate bespoke/studio creation cohorts, expected booking value,
recorded net payments, campaign groups, staff-attested first response and current published occupancy.
Source links make totals traceable. Optional PostHog EU aggregate reads remain off pending separate
approval and secure configuration. See [definitions and activation gates](docs/conversion-overview.md).

## Service landing pages

Publish a service card, then choose it under a page's **Page settings → Landing page service**.
Use an intro/hero for the campaign headline and approved media in the existing blocks.
The service card owns the description, optional inclusions, price guidance and approved
human-response wording; the same published details appear on the landing and enquiry form.
Missing services disable the landing action without substituting another offer.

Local and preview initialization add `/service-demo` with clearly synthetic content and
abstract artwork, preserving existing edits. Real photos, offer wording and any response
promise still need owner input. The receipt saves an enquiry; it does not reserve a date,
confirm a booking or send visitor mail in preview. See [the landing spec](specs/service-inquiry-landings/requirements.md).

## Studio days and sessions

Use **Studio days** in the photographer workspace to create a rented studio day. Enter the actual
location, timezone/date, offer, price/currency, duration/buffer, hours, deadline and change conditions.
Save and privately preview a draft, then publish and explicitly open bookings. Immediate confirmation
is the default; approval can be required per day. Pending requests use a place until approved or
cancelled. Choosing a time alone creates no hold.

Reservations and staff changes share PostgreSQL capacity checks. Existing commitments keep their
saved details when a day changes; affected publication requires a fresh acknowledgement. Reschedule,
approve or cancel through the studio controls. Customer email is a private test draft only, with a
visible retry if preparation fails. Only approved rules can produce confirmed-session reminder
simulations. No unattended sender or payments are enabled.

Local/preview bootstrap adds `/studio-days/studio-demo` with clearly synthetic dates, venue and price,
preserving editor changes. Real commercial details and imagery still need owner input. The migration
preserves existing enquiry bookings and refuses rollback once studio-day data exists. See the
[studio-day specification](specs/studio-days-session-slots/requirements.md).

## Page experiments

Private CTA experiment planning, staff simulation and results are available under **Page experiments**.
Live delivery remains disabled. Assignment needs separate page-test consent; exposure and saved-enquiry
outcomes are deduplicated. Results show uncertainty without declaring a winner. See [the groundwork
runbook](docs/experiments.md) for the simulation journey and remaining launch gates.
