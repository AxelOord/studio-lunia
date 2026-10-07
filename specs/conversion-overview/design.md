# Conversion overview — design

## Snapshot and authorization (R-1, R-2, R-3, R-4)

Add a private Payload view and no-store API with bounded UTC filters. Verify the actual user's read
access to every source collection; reject conditional access instead of aggregating outside its scope.
Use a read-only repeatable-read PostgreSQL transaction. Read minimal enquiry/booking facts in complete
keyset pages; aggregate every row without a recent-record cap. Per-booking ledger totals use entry
currency, avoiding multiplication by proposal/contact joins. Never load contact or message contents.

Keep separate bespoke/studio metrics and service/day/campaign groups. Project only allowed historical
campaign identifiers without applying today's browser-cookie TTL. Paginate groups and source records.
Current operational counts are separate from creation cohorts. Occupancy uses each day's latest
published version and immutable slots, not a newer private draft; count overlapping active commitments
across revisions and report commitments outside published inventory.

## Human response (R-3)

Reuse the idempotent customer-record command and immutable activity history. Staff attest to the first
outbound response with an actual timestamp and reason. Corrections or clearing append history under
the enquiry lock; report the latest entry by creation order. Add a shared control in the enquiry
workspace/native record. No email or automation is triggered and no schema migration is needed.

## Optional PostHog reader (R-5)

The pinned [official Query API source](https://github.com/PostHog/posthog.com/blob/89b603752551ec71ad914e76e51bfa952af1e098/contents/docs/api/queries.mdx)
and [EU authentication/host source](https://github.com/PostHog/posthog.com/blob/89b603752551ec71ad914e76e51bfa952af1e098/contents/docs/api/index.mdx)
were checked 2026-10-06. A disabled server-only adapter uses the fixed EU query host, approved project ID
and separate query:read key. Its fixed FunnelsQuery requests only the existing three events, ordered
within 24 hours. Normalize integer aggregate counts only; fail closed on async/incomplete, malformed,
oversized and error responses. Do not log credentials or provider bodies. No new SDK/capture or
provider mutation. The UI distinguishes consented sessions from internal cohorts and explicitly shows
missing studio visitor steps/spend; no invented conversion or cost figures.

## Verification and boundaries (R-6)

Real owned PostgreSQL fixtures reconcile repeats/retries, statuses, currencies, corrections, attribution,
first response and revised occupancy. Unit tests cover date/campaign/provider boundaries. Real browser
tests cover filters, exact source links, empty/error states, correction and mobile layout. Run all
existing aggregate checks and inspect exact-head CI. Report quota-blocked hosting separately.
