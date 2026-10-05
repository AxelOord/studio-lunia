# Shared preview editor — requirements

Workflow: requirements-first
Status: ready

## Goal and scope

Implement [#31](https://github.com/AxelOord/studio-lunia/issues/31), fetched with its
comments on 2026-10-05 after the owner selected a shared default. Start from verified
develop `7f3f2264e927c47d64362ddfe2b2b8fb04733303`, independently of PR32. Authorized
testers can use new protected full-CMS previews without per-branch password resets.
No provider writes, existing-password resets, production changes or CI changes.

## Acceptance criteria

### R-1: New test accounts use the shared preview default

WHEN an approved preview database has no editor, bootstrap SHALL create the approved
editor with the owner-supplied Preview-only PREVIEW_EDITOR_PASSWORD. A missing or
invalid value SHALL fail without creating an editor. Retain the 16-character editor
minimum and reject line breaks/NUL; database credentials retain their separate 24 minimum.
Check: Two fresh isolated local databases accept the same dummy password; missing/invalid
fixtures create no account; the default never appears in logs or public user responses.

### R-2: Existing accounts and content survive redeploys

WHEN any editor already exists, bootstrap SHALL preserve passwords and edited content,
without reading or requiring the default. An unapproved existing mailbox SHALL fail
without provisioning another editor. A changed default SHALL affect only new accounts.
Check: Re-bootstrap with a throwing password supplier and with a different default;
the old chosen password still logs in, the replacement fails, and page edits persist.

### R-3: Preview and access boundaries remain enforced

The shared default SHALL be read only in approved build-time preview bootstrap.
Production, local, showcase, wrong-project/repository and release-branch configurations
SHALL reject this path. Anonymous user creation, private reads and admin access remain
blocked. Vercel Authentication SHALL remain enabled with no bypass changes.
Check: Configuration tests, build subprocess rejection without secret leakage, real
Payload anonymous access tests, and browser login/anonymous redirect checks.

### R-4: Secure owner handoff and truthful evidence

The runbook SHALL document the variable name, Preview scope, protected sign-in path,
new-accounts-only behavior and authorized private sharing, never the credential value.
Local tests SHALL use dummy fixtures. Hosted success SHALL not be claimed before owner
secure entry and authenticated verification; no ticket closure based on code alone.
Check: Reviewed diff, exact-head CI and a protected automatic preview after owner handoff.

## Remaining handoff

The owner must enter PREVIEW_EDITOR_PASSWORD securely in Vercel Preview settings.
No actual credential value is needed by this coding task. Existing accounts require a
separately approved reset if the owner later wants to change them.
