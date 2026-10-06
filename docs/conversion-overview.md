# Conversion overview

Open **Conversion overview** in the private workspace navigation. The default is the last 30
inclusive UTC calendar days; a report accepts at most 366. Current work cards ignore the cohort
period and open their matching source collections. Source lists and breakdowns show 20 records per
page; totals include all matching records. Reads use one database snapshot and never update history.

## Definitions

- Bespoke cohorts use enquiry creation dates. A recorded proposal qualifies an enquiry; one or
  several currently confirmed/completed bookings convert it once. Repeated enquiries remain separate
  intents. Linked unique contact IDs are reported separately; matching emails do not merge identities.
- Studio cohorts use booking creation dates and the currently agreed studio day. Changes and retries
  preserve the booking identity. Pending approvals are separate from confirmed/completed outcomes.
- Expected value includes confirmed/completed bookings. **Recorded net payments** sum all manual
  payment/refund entries and correction reversals attached to cohort bookings, including cancellations
  and entries after the cohort period. Each entry's currency stays separate. This is neither
  bank-verified collection nor profit, and it is not a payment-date revenue report.
- Cancellation rate is cancelled / (confirmed + completed + cancelled). A zero denominator is
  unavailable. Proposed and pending bookings are excluded.
- First human response is a staff-attested personal outbound response, entered in the enquiry record
  or workspace. Give the actual local time and a reason. Correction and clearing append history;
  the latest entry controls the metric. Automated receipts, drafts and incoming replies do not count.
  The median covers only recorded responses; recorded/all enquiry coverage is shown alongside it.
- Occupancy uses session dates, independently of creation cohorts: allocated current published
  slot-places / current published slot-places. Pending approvals and older overlapping commitments
  count. Longer bookings can block several current slots. Unpublished/cancelled days are excluded;
  active commitments outside this inventory are shown separately. It does not reconstruct historical
  capacity.
- Campaign groups use the frozen first/last eligible touch. Unknown, withheld, direct and untagged
  sources remain visible. Click IDs are excluded from the report. Cost per booking is unavailable
  because no matched spend source is connected.

## Optional EU funnel read — disabled

The existing anonymous-session events can be read as an ordered, 24-hour service-view → enquiry-start
→ enquiry-submit funnel across all services. A session may view one service and enquire about another.
It covers only consenting, successfully measured sessions, not people, all visitors or internal
creation cohorts. The report does not identify customers or join sessions to records. Studio visitor
and booking steps are not instrumented; no visitor-to-booking rate is inferred. Replay remains off.

`LUNIA_POSTHOG_REPORTING_ENABLED` defaults to false. If disabled, there is no provider request. If
enabled but missing access, or if a query fails/is incomplete, the UI says unavailable rather than zero.
The server requests only a fixed aggregate query and returns three counts; it does not expose provider
responses, people/properties or credentials. Existing tracking consent and withdrawal behavior is
unchanged. No new SDK or capture event is added.

Activation is a separate owner decision: approve the exact EU project, applicable service/legal terms,
project access and a least-privilege credential with **Query Read** restricted to that project. The
ingestion token is not a reporting credential. Use the provider and Vercel secure environment-variable
UIs to supply `POSTHOG_REPORT_PROJECT_ID` and `POSTHOG_QUERY_READ_KEY` for the approved environment;
never paste secrets in chat, issues, PRs, logs or source. Only after that approval/configuration should
the reporting flag be enabled and hosted consented/no-consent/withdrawal flows verified. No account,
project, credential, terms acceptance or provider settings were created or changed for this PR.

The adapter is based on the pinned official [Query API](https://github.com/PostHog/posthog.com/blob/89b603752551ec71ad914e76e51bfa952af1e098/contents/docs/api/queries.mdx)
and [EU API host/access documentation](https://github.com/PostHog/posthog.com/blob/89b603752551ec71ad914e76e51bfa952af1e098/contents/docs/api/index.mdx),
checked 2026-10-06. Synthetic provider tests prove local behavior only; they do not prove hosted analytics.

See [requirements and acceptance gates](../specs/conversion-overview/requirements.md). Hosted CMS
verification remains blocked by the previously verified Neon branch limit; no quota workaround,
resource deletion, provisioning retry or paid upgrade is authorized here.
