# Testing and standards inventory

Baseline: PR34 merge head a458215, inspected 2026-10-05. The immediate repair changes
only the editorial test's image ownership. Broader changes remain a separate PR.

| Existing checks                                    | Meaningful coverage to preserve                                                                                                                                       | Delivered home                                                                                              |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| TypeScript unit tests (32, including 4 hook tests) | Consent/campaign minimization, bounded input, email rendering and delivery ordering, signed webhooks, preview gates, redacted errors, Git hook behavior               | Pinned Vitest unit project; retain Windows hook portability                                                 |
| PostgreSQL integration tests (29)                  | Real migrations, access/drafts/media, concurrent enquiry/booking/email operations, immutable history, atomic money changes, recovery/throttling and preview bootstrap | Vitest integration project with isolated databases and owned fixtures                                       |
| Playwright scenarios (19)                          | Actual public/admin workflows, mobile layouts, retry/double-click deduplication, missing consent, blocked storage, draft access and frozen email previews             | Playwright; add relevant cancel/back checks and retain failure artifacts                                    |
| Python setup tests (16)                            | Password transport only through stdin, escaping, target/TLS guards, hidden prompts, redacted errors, safe child environment and backup prerequisites                  | Keep Python, named tooling/security verification stage                                                      |
| Python connection tests (5)                        | Literal password round-trip, approved target, clipboard safety, control-input and noninteractive denial                                                               | Keep Python, same stage                                                                                     |
| Python backup tests (4)                            | Private archive verification, restore counts and cleanup only of owned temporary databases                                                                            | Keep Python, same stage                                                                                     |
| Python spec tests (10)                             | Traceability, preservation/evidence requirements, traversal/symlink denial and no overwrite                                                                           | Keep Python, same stage                                                                                     |
| Release tests (12)                                 | Explicit completion, semantic versioning, immutable release candidates, permission/production guards, safe transport and idempotent Project updates                   | Preserve all behavior and release workflow; consolidate runner only where appropriate                       |
| Three standalone app checks                        | Built dependency trace detects real image bytes; actual private-upload file-picker metadata; credential-free showcase route/access/navigation behavior                | Move browser behavior to Playwright and built-artifact check to a named suite, preserving provider blocking |

## Concrete reliability gaps

- CMS editorial blocks borrowed the newest media row from a shared database. The
  minimal fix creates a dedicated image in that test and deletes it after its page.
- Integration files share DATABASE_URL and local media storage. Several tests depend
  on earlier tests' IDs/state (notably Blob and customer-record sequences).
- Recovery expiry updates every rate-limit row. Scope the update to its own fixture;
  isolated databases also prevent this from changing another suite's behavior.
- Some fresh-database helpers do not guarantee every cleanup step if an earlier
  cleanup fails. Use an explicit local-only lifecycle, not a hosted connection.
- Local README commands do not include all CI-only application checks. Provide one
  verification entry point backed by the same named stages used in CI.

## Existing coding guarantees

TypeScript already has strict and isolatedModules enabled. ESLint uses pinned Next
Core Web Vitals/TypeScript rules; explicit any and unsafe TypeScript comments are
errors, unused variables are warnings rejected by the zero-warning command. Prettier
and generated-file drift are checked. Preserve those rules.

Collection access is shared through src/access. Customer operations additionally
validate actor/input, and the HTTP boundary enforces authentication, same origin,
bounded JSON and safe errors; tests cover forged capabilities and anonymous access.
Audit client/server imports and asynchronous error paths for focused missing checks.
Do not replace these boundaries with extra architectural layers or arbitrary metrics.

## Runner provenance

The npm registry reports Vitest 5.0.3 supporting Node24. The official current guide,
projects configuration and test-context documentation were inspected before selecting
the integration approach: https://vitest.dev/guide/, https://vitest.dev/config/projects,
https://vitest.dev/guide/test-context. Confirm installed pinned types during implementation.

## Delivered coverage map

- 28 existing application unit cases now use Vitest; four new cases verify local-only
  database targets, provider environment isolation, UI import boundaries and floating
  promises (32 unit cases). The four Node Git-hook checks remain unchanged.
- All 29 integration cases retain their behavior assertions. Two new real-database
  cases verify concurrent ownership/drop isolation and cleanup after failed CMS setup
  (31 cases). Customer email/booking, Blob namespace and CMS editorial cases create
  their own prerequisites rather than borrowing earlier state. Anonymous denial is
  now unconditional instead of guarded by a prior test's contact list.
- All 19 existing Playwright scenarios remain; showcase and upload metadata add the
  two former standalone checks (21). Email preview now explicitly navigates back and
  verifies the unsaved subject did not replace the saved approved template.
- The standalone traced-upload check is a Vitest build test with the original real
  PNG/non-image probe against only the copied traced deployment dependencies.
- All 35 Python, four hook and 12 release assertions remain in their original runners.
  No security/release workflows or repository permissions are changed.

The lockfile adds exact Vitest 5.0.3 and its dependencies. npm also relocates existing
esbuild/yaml versions during deduplication; Payload, Next, React and all other direct
application pins stay unchanged. Large platform-package sections account for most of
the lockfile diff.
