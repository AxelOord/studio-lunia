# Shared preview editor — design

## Approach and boundaries

Keep the existing advisory-locked migration/bootstrap path. Add a build-only password
reader guarded by the existing complete deploymentMode validation. Pass it lazily to
initializePreview so an existing account never reads or requires the new variable.
Payload's pinned canary create operation hashes the credential; no collection, schema,
HTTP route, runtime login policy, CI or provider setting changes are needed.

## Behavior mapping

R-1: Empty users collection invokes the supplier immediately before Payload create.
The supplier checks the 16-character minimum and disallows CR/LF/NUL. No random fallback
means a missing owner handoff cannot accidentally seed an unusable account. Build errors
report only the phase/configuration hint; no raw exception, email or secret is logged.

R-2: Retain existing mailbox verification and seed-if-missing content behavior. Existing
accounts bypass the supplier, including when the secret is missing/changed. No reset,
update, recovery email or destructive branch/account cleanup is introduced.

R-3: The password reader lives under scripts and repeats the full approved-preview gate;
preview-build already rejects production before database connection. Remove the default
from the child compiler environment after bootstrap. No NEXT_PUBLIC alias or client
reference exists. Existing Users auth/access hooks, Neon per-branch selection, shared
migration lock and Vercel Authentication configuration remain intact.

R-4: Add only a blank example key and secure owner-entry/sign-in instructions. Preserve
older previews' passwords. Run local tests with synthetic fixtures, then exact-head CI.
The automatic preview may fail bootstrap until the owner supplies the secret; report
that dependency explicitly and verify it after handoff without retrieving the value.

## Tradeoffs and verification

A shared password is the owner's explicit choice for synthetic previews behind Vercel
Authentication. No account on an existing PR is silently updated to match it. Reuse
real fresh-database migration tests twice to prove initialization and isolation, extend
configuration/redeploy/access assertions, and inspect desktop/mobile login screenshots.
The existing 24-character runtime database guard is unrelated and remains unchanged.
