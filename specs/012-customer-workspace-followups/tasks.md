# Customer workspace and safe follow-up planning — tasks

- [x] T-1: Verify pinned admin-view and persistent-job extension points
      Refs: R-2, R-7, R-8, R-10
      Depends: none
      Verify: Minimal authenticated view and isolated job waitUntil/run/cancel/lease experiments; identify version-specific behavior before committing schema.
      Evidence: Pinned canary.37 source/types and provider limits inspected. Real PostgreSQL tests exercise waitUntil, job leases, concurrent run and retry persistence. Browser tests verify the native dashboard and explicitly wrapped custom routes.
- [x] T-2: Add follow-up plans, rules and additive migrations
      Refs: R-4, R-5, R-9
      Depends: T-1
      Verify: Existing-record migration preservation, exact preview/revision snapshots, trigger deduplication, timezone validation and private access.
      Evidence: Additive migration and rollback preservation test; plan snapshots, exact-preview acknowledgement and trigger replay covered by followups.test.ts.
- [x] T-3: Implement durable simulation jobs and shared stop rules
      Refs: R-5, R-7, R-8, R-9
      Depends: T-2
      Verify: Actual PostgreSQL run/cancel/reply/booking race orders, duplicate jobs, stale revisions, bounded retry/lease recovery, overdue/error visibility and zero provider sending.
      Evidence: 14 follow-up integration cases cover duplicate runs, both cancellation orders, opt-out/reply/session/link/delivery stops, safe failures, three-attempt bound, persisted Payload retry time and expired lease recovery.
- [x] T-4: Implement the disabled narrow incoming-reply boundary
      Refs: R-5, R-6, R-8, R-9
      Depends: T-2
      Verify: Synthetic valid/forged/expired/duplicate events, approved-route matching, unknown-match review and stop behavior; no live mailbox or provider configuration.
      Evidence: Unit signature/expiry/oversize tests plus verified-reference matching/replay/private review integration; public receiving route returns 503. No provider access configured.
- [x] T-5: Build the guided inbox and customer workspace
      Refs: R-1, R-2, R-3, R-4, R-9
      Depends: T-2
      Verify: Search/filter/pagination, exact in-context email review, proposal and booking commands, planned-message actions, clear empty/loading/error states and safe back/cancel.
      Evidence: Current collection-oriented desktop/mobile screenshots and code inspected; flow-map.md records concrete gaps and intended routes.
- [ ] T-6: Verify the whole workflow and review the batch
      Refs: R-1, R-2, R-3, R-4, R-5, R-6, R-7, R-8, R-9, R-10
      Depends: T-3, T-4, T-5
      Verify: npm run verify, isolated/shuffled/concurrent regressions, full keyboard/mobile/desktop journey, screenshot QA, independent review, exact-head CI and protected CMS preview.
      Evidence: Two Playwright journeys cover inbox empty/search/error recovery, keyboard access, private draft review, booking, plan edit/pause/resume/simulation and stops at desktop/390px. Four screenshots inspected; native wrapper and color-token defects corrected.
- [ ] T-7: Publish honest acceptance evidence and activation decisions
      Refs: R-6, R-8, R-10
      Depends: T-6
      Verify: Draft PR issue/spec links, exact SHA/preview, tested versus unconfigured paths, content/timezone/inbound/runner approval checklist with no premature issue closure or activation.
      Evidence: pending
