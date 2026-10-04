# Tasks

- [x] T-1: Establish reproducible app and workflow
      Refs: R-1, R-4
      Depends: none
      Verify: npm run check; npm run build; npm run spec:check
      Evidence: Local npm ci, check, build and spec:check passed; see docs/verification.md.
- [x] T-2: Verify CMS publishing, uploads and preview
      Refs: R-2, R-3
      Depends: T-1
      Verify: npm run db:migrate; npm run test:integration; npm run test:e2e
      Evidence: Migration applied; 4 integration tests and 4 browser scenarios passed, including protected preview and upload URLs.
- [x] T-3: Define attribution boundaries
      Refs: R-5
      Depends: T-1
      Verify: npm test; architecture review
      Evidence: 5 unit tests passed; contracts make no network calls or persistence; architecture records Google Ads-first adapters.
- [ ] T-4: Prepare review and Vercel preview
      Refs: R-6
      Depends: T-2, T-3
      Verify: draft PR exact-head CI; inspect preview and record infrastructure blockers
      Evidence: Local showcase smoke passed; draft PR #1 opened, foundation CI passed, separate Vercel project configured. Feature preview verification pending.
