# Page experiment groundwork (#14)

Live delivery is **disabled by default** (`LUNIA_EXPERIMENTS_ENABLED=false`, also forced
false by all normal test environments). No provider, account or additional credential is
needed. This batch does not complete the issue's first live-test acceptance. The owner must
agree a measured baseline, meaningful sample/power and stopping plan, review consent copy,
verify hosted behavior and explicitly authorize a launch first. No statistical winner is
calculated or inferred by this implementation.

## Author and rehearse

1. In **Page experiments → New experiment**, choose a published page with a landing service.
   The exact landing is the audience; only browsers with separate page-test consent qualify.
2. Record one hypothesis, an alternate CTA (up to 70 plain-text characters), its percentage
   allocation, baseline, sample rationale, minimum exposures per variant and calendar duration.
   The only outcome is a saved enquiry for that service within 30 days of visible CTA exposure.
3. Leave mode **simulation**. Save a draft while planning, then choose **Prepared**. Preparation
   snapshots the current published original CTA and service. The complete design freezes;
   use a new plan for a different design. Only one prepared live plan per page is allowed.
4. Open **Page experiments** and choose **Try simulation on landing**. This sets a signed
   one-hour simulation selection; every request also needs the current staff login. Explicitly
   accept page-test consent, bring the CTA into view, follow it and submit synthetic details.
   The same persistence/exposure/enquiry code runs. Results are labelled synthetic, and a
   simulation cookie never provides anonymous or live access. No provider is contacted.
5. **Stop experiment** permanently stops assignment and measurement. Already rendered tabs keep
   their visible copy until reload/navigation; the server rejects further measurement immediately. Both CTA snapshots and
   results stay available. **Copy original/alternate to page draft** changes only that field
   on the latest page draft; it preserves other work and does not publish. Review through the
   normal page workflow before deciding to publish.

A live plan marked Prepared still does nothing while the independent runtime gate is off.
Do not change that gate as part of this groundwork. Existing editor draft previews never
assign or measure. Unpublishing/changing the landing service or original CTA suspends eligibility.
No automatic seed experiment is added, and existing page content is unchanged.

## Consent, identity and counts

Page-test consent is independent of campaign storage and PostHog measurement. Older preferences
never grant it. Only an explicit grant creates an HttpOnly, SameSite=Lax signed random browser
cookie for 30 days; visits do not renew it. A signed cookie alone is insufficient: each request
also checks current preferences, runtime/mode, publication and eligibility. Staff are excluded
from live assignment. Clearing/expiring cookies or granting again after withdrawal creates a
new browser identity; counts are not unique people and cannot be joined to customers.

The database stores a keyed hash, expiry/revocation tombstone and one row per experiment/browser:
variant, assignment time, first visible exposure, first qualifying conversion. No form text,
contact ID, enquiry ID, email, IP, fingerprint, campaign tag or URL query is stored there. Browser
identity rows currently remain with experiment results for review; operational retention/deletion
must be agreed before live activation. Raw identifiers are not in the private results response.

Withdrawal pauses this tab immediately, aborts outstanding experiment requests, broadcasts a pause
to other open tabs, revokes the database identity and removes the cookie. Participant row locks
serialize revocation against first assignment, exposure and conversion. A request committed before
withdrawal can remain counted; requests serialized after revocation cannot record using an old
cookie. Other tabs resume only on refresh and then read the saved preference. A failed save shows
a retry message and keeps this page paused; reloading before successful withdrawal can restore the
previous persisted choice. Prior enquiries and counts are not erased by withdrawing.

Assignment uses a stable hash bucket and a unique experiment/browser key. Exposure requires at
least half the CTA to intersect the viewport after the variant text is rendered. Repeated visits
and concurrent retries update the same row. Client visibility is an acknowledgement, not proof a
human read it. Only the server's newly committed enquiry path can record conversion; a lost-response
retry cannot backfill or duplicate conversion. Stopped/expired/unexposed/mismatched requests cannot
convert. Measurement failure never fails a durable enquiry; no later replay/outbox is added.

## Results and interpretation

Results show assigned, exposed and converted browsers per variant. Conversion is converted /
exposed, unavailable for zero exposures. A descriptive 95% Wilson interval expresses binomial
uncertainty but assumes independent samples. No p-value, significance claim, automatic winner,
relative uplift decision or automatic stopping is provided. Sample and duration thresholds are
planning checks, never proof of a winner. Review allocation imbalance, missing consent/events,
repeat identities, confounding traffic, peeking and the predefined analysis before interpreting.

Assignment is applied after consent is read and the server response arrives; the original CTA
renders first. That brief initial display, fast navigation, blocking and network failure can
bias or omit exposure. The groundwork deliberately cannot support an evidence-backed live
conclusion without further acceptance and review. It measures enquiries, not quality, bookings
or revenue. Multiple experiments on different landings for one service can influence each other;
plan one focused live test before expanding traffic.

## Verification and integration contract

See `specs/experiment-groundwork/verification.md`. New integration fixtures use isolated local
PostgreSQL databases. Browser tests use a production build and synthetic staff/visitor data, with
no live runtime flag or provider enabled. One integration case temporarily exercises the live gate
inside its owned local database and restores the disabled setting.

Shared modules: `PrivacyControls`, the privacy route/preferences, `ServiceInquiryLink`/landing
rendering and the successful enquiry route. No `measurementEvents`, PostHog payload, PostHog
aggregate reader or studio-session instrumentation changes. The independent #28 funnel work can
keep its taxonomy; page experiments use their own tables and endpoints. Review these shared
privacy/CTA seams when combining dependent branches. Feature branch starts from PR #42 at
`8aa1c1bf2948a023d64899576ee779072f7d2066`; the owner controls merges.
