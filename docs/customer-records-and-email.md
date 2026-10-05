# Private customer records and email history

Scope: [#10](https://github.com/AxelOord/studio-lunia/issues/10),
[#23](https://github.com/AxelOord/studio-lunia/issues/23), and
[#24](https://github.com/AxelOord/studio-lunia/issues/24).
This is a staff record and manual money history, not a payment processor, calendar,
accounting system, inbox integration or scheduled sender.

New enquiries get separate contacts, even for matching email addresses. Staff can explicitly
relink an enquiry after checking identity. Its original submitted details and attribution
stay fixed. Existing booking/message snapshots retain their recorded contact relationship;
relinking an enquiry does not rewrite historical records. Contact search has new, waiting,
upcoming and email-attention filters. Timeline facts show their source and occurrence date;
known replies are explicitly staff reported. Unknown inbound messages remain unknown.

From an enquiry, create a proposal with an explicit three-letter currency and integer minor
units. Confirm/complete/cancel with a reason; confirmation requires a session date. Expected
value is separate from manually recorded receipts/refunds. Cancellation never invents a
refund. Corrections append a reversal and replacement atomically. Repeating the same command
key returns the original result; changed details with that key conflict. No Ads outcome is sent.

Email templates start as unapproved example copy. Review wording before approving. Editing
approved content clears approval; save, review and approve it again. Preview uses the same
renderer as preparation, with these allowed variables: `contact_name`, `service_title`,
`booking_status`, `session_time`, `expected_value`, `studio_name`. A missing/unknown variable
blocks preparation. Text is escaped; arbitrary HTML/assets/scripts are not rendered.
Prepared snapshots freeze the template, variables, subject, text/HTML, recipient and source
links. Subsequent source edits do not change that snapshot.

Customer drafts stay private and unscheduled; real-customer sending is disabled. An explicit
sandbox test uses synthetic variables and only the configured preview editor recipient.
Review the frozen snapshot before its separate send action. Local mode disables delivery.
Enquiry photographer notices share this sender with fixed privacy-safe wording. A send attempt
freezes its provider payload/key before the network call; concurrent attempts use a two-minute
lease and retry the identical payload at most three times, within 23 hours of the first attempt.
A missing provider ID or transport failure is uncertain, not confirmed delivery. After the
window, inspect the provider dashboard manually. Never reset a key to force a resend.

`accepted` means Resend accepted a request. `delivered` means the recipient mail server
accepted it, not a read receipt. Delayed/bounced/failed facts are distinct. Historical enquiry
notifications without captured bodies/provider IDs remain labelled unavailable, and previously
attempted legacy requests are never resent using a changed payload. Provider callbacks do not
change the recorded send-attempt time.

## Delivery callback activation is blocked pending a separate decision

`POST /api/resend/webhook` is disabled unless both `LUNIA_RESEND_WEBHOOKS_ENABLED=true` and
`RESEND_WEBHOOK_SECRET` are securely configured. No webhook or new credential was registered
by this batch. Signed local fixtures establish implementation behavior only, not hosted ingress.

The protected Hobby preview has no path-specific POST exception. An OPTIONS allowlist does
not enable this POST. The available automation bypass grants access across deployments/paths
and some firewall controls, so it is not an approved narrow webhook solution. Keep the flag
off and preview protection intact. Do not put a bypass credential in a callback URL.
A future separate public ingress project/durable store would require exact approval for its
production deployment, storage/access, retention and operational ownership; none is added here.

Resend's selected events may cover the whole account and include recipient/sender/subject,
provider IDs, timestamps and failure details. This is not a status-only provider feed. Any
activation request must disclose that scope and name the destination, account/project, six
events (`email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.failed`,
`email.suppressed`), secret handoff and access arrangement. Open/click/inbound tracking is excluded.
The existing sending-only key need not be broadened; approved registration could use the owner
dashboard. Never paste signing credentials in tickets, logs or PRs.

The receiver verifies unchanged raw bytes using Svix ID/timestamp/signature and a five-minute
tolerance. It stores only correlated event ID, provider ID, event kind and dates, in a transaction
before acknowledging. Opaque outbound tags correlate callbacks arriving before the send response.
Unrelated account events are ignored without persistence of their addresses/content. Retries are
deduplicated; terminal status derives from occurrence time, not arrival order. Permanent
bounce/suppression remains terminal. No raw provider payloads, opens/clicks or analytics are stored.

A preview branch URL/alias is temporary, not a permanent production endpoint. Branch retirement,
Neon cleanup or alias changes require unregistering/repointing any future webhook first and
preserving approved operational evidence. No live callback may silently target an abandoned branch.

## Preservation and privacy

The additive migration backfills one contact per legacy enquiry and records historical facts
without changing existing enquiry fields or inventing old email bodies. It seeds only unapproved
example templates. Automatic destructive down-migration is blocked; use an approved backup restore
or reviewed forward correction. Existing native preview migration/bootstrap applies it normally.

All operational records and custom routes require the editor session. Public enquiries can only
create their validated record; internal capabilities cannot be forged through JSON. Staff cannot
rewrite/delete the append-only history or email snapshots through REST. No operational PII goes to
PostHog, public fixtures or browser URLs from the custom search. Existing consent logic is unchanged.
Native Payload list search is still a staff-only CMS facility.

There is no invented retention duration or automatic purge. Before real-customer activation,
Axel must approve retention/erasure handling, wording, sender/domain/reply route, recipients and
service terms/access. Handle an erasure/correction request through a separately approved maintenance
procedure covering contacts, submitted enquiry copies, message snapshots, provider records, backups
and related immutable facts; do not silently overwrite evidence or promise complete external inbox history.

## Pinned sources and verification

Implementation uses Payload 4.0.0-canary.37's installed transaction API and generated schema.
Resend HTTP v1 send API and documented Svix webhook protocol are used directly, without an SDK
upgrade. References checked 2026-10-05:
[Resend event meanings](https://resend.com/docs/webhooks/event-types),
[raw signature verification](https://resend.com/docs/webhooks/verify-webhooks-requests),
[idempotency window](https://resend.com/docs/dashboard/emails/idempotency-keys),
[webhook delivery/tags](https://resend.com/docs/webhooks/create-webhook), and
[Svix manual verification](https://docs.svix.com/receiving/verifying-payloads/how-manual).

Run `npm run check`, `npm run test:integration`, `npm run build`, `npm run test:e2e` and
`npm run format:check`. Tests use local synthetic records/fake send transport and no external
mail. See the batch spec for current evidence and the PR for exact SHA/automatic preview.
