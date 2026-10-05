# Automatic full CMS previews

Approved by Axel on 2026-10-05. This uses the existing native Vercel/Neon integration,
normal Git preview builds, shared preview-only services and synthetic data. The old
site and production are unchanged. No management API keys or new paid services.

## Provider handoff

Connect the existing Neon resource to **studio-lunia Preview only** with preview
branching and the required deployment readiness action. Native inspection found the
source `neondb`, role `neondb_owner`, with zero public tables. It is not the legacy
`lunia_preview` database. Confirm each deployment receives its preview branch before
accepting the hosted result. The owner-capable account at runtime is an approved
tradeoff for trusted synthetic previews, not production security hardening.

Set these only for Preview (provider UI; never export values to chat or the repo):

| Setting               | Value/source                                       |
| --------------------- | -------------------------------------------------- |
| DATABASE_URL          | Native pooled preview-branch connection            |
| DATABASE_URL_UNPOOLED | Native direct connection to the same database/user |
| LUNIA_SHOWCASE        | false                                              |
| LUNIA_CMS_PREVIEW     | true                                               |
| LUNIA_PREVIEW_REVIEW  | approved                                           |
| LUNIA_STORAGE         | private-blob                                       |
| PAYLOAD_SECRET        | Existing approved preview signing secret           |
| BLOB_READ_WRITE_TOKEN | Existing private preview store token               |
| RESEND_API_KEY        | Existing approved preview mail key                 |
| MAIL_FROM             | onboarding@resend.dev                              |
| PREVIEW_EDITOR_EMAIL  | Existing privately configured approved mailbox     |

Expose Vercel system environment variables, including VERCEL_PROJECT_ID,
VERCEL_GIT_REPO_OWNER, VERCEL_GIT_REPO_SLUG, VERCEL_GIT_COMMIT_REF,
VERCEL_BRANCH_URL and VERCEL_URL. The application gate accepts only the exact
studio-lunia project and AxelOord/studio-lunia repository, with a non-release branch.
Keep Vercel fork-deployment protection enabled: an environment variable check is
not a substitute for reviewing code that will receive shared preview capabilities.
No privileged pull_request_target workflow is introduced.

Remove obsolete branch-scoped overrides when they conflict with these settings.
LUNIA_CMS_BRANCH and manual CMS_ORIGIN are no longer used for hosted configuration.
The legacy branch-scoped DATABASE_URL must not override native deployment injection.

## Build and first login

`vercel.json` selects `npm run build:preview`. Configuration is validated before any
migration, including matching direct/pooled database identity and TLS. The build
holds a direct-session PostgreSQL advisory lock while running committed migrations
and idempotent bootstrap. Schema push stays disabled; a migration warning requiring
manual confirmation fails closed. Errors fail the build, never publish a showcase.
Next/Payload compilation begins only after successful preparation. The canary's
metadata-only destroy method is followed by explicit pg.Pool shutdown.

An empty database gets one editor for PREVIEW_EDITOR_EMAIL, with a cryptographically
random password that is discarded without logging. Open `/admin/login`, choose
Forgot password, and use the emailed link to choose a password of at least 16
characters. No password is supplied to builds, and public first-user registration
remains blocked. Rebuilds preserve the editor's password and changes; they do not
send reset emails or reset accounts. An existing database without the approved
editor fails bootstrap instead of silently adding another user.

Missing home/blocks pages receive six editable block types and two explicitly
synthetic colour-study images. Existing pages, including drafts, remain untouched.
Booking and tracking are still future product scope, not disabled CMS features.

## Origins, images and lifecycle

Recovery links use the actual VERCEL_BRANCH_URL. API/media requests stay same-origin;
CSRF/CORS permit only provider-supplied branch and deployment origins. No caller Host
header determines the reset destination. Test both URL forms in hosted acceptance.

New private Blob objects live under a SHA-256 namespace of project ID and full Git
ref. Upload grants, reads, writes, updates and deletion enforce that namespace.
The shared store token remains capable of accessing other preview objects from trusted
server code; namespaces are an application boundary, not provider-level hostile-code
isolation. Start native branches from the verified empty source, not a database
containing foreign namespace media records. Do not silently remap old media metadata.

Native branches persist across commits of a Git branch. Additive migrations preserve
older deployments sharing that database; incompatible changes require review. A DB
lock prevents simultaneous migrations, but superseded-build promotion still needs
hosted verification. Retain the current Free plan/10-branch limit and default provider
retention. Retention exceptions may retain branches; report exhaustion instead of
automatically deleting active editor work or upgrading. Shared Blob orphans are
reviewed separately; no automatic destructive cleanup is added.

## Acceptance evidence

Local/CI checks cover new-database migrations, idempotent bootstrap, preserved password
and drafts, actual CMS browser login/edit/preview, image derivatives/access, recovery
token lifecycle, namespace denial, and fail-closed build configuration. Local Blob
integration uses an in-memory provider boundary, not a claim of hosted provider ACLs.
Hosted acceptance must still prove native branch identity, real Blob upload/read,
mailbox reset, both URL forms, rebuild persistence, two distinct branches and latest-
commit behavior. Do not label the read-only showcase as that evidence.

## Preview control and upload diagnosis

In Payload canary.37 the chain-link preview control copies the URL on ordinary click;
Ctrl/Cmd-click opens it in a new tab. A logged-in editor can also visit
`/preview?slug=<page-slug>` on the same preview host. This is session-authenticated;
the URL contains no bearer token.

For a rejected upload, distinguish the actual browser/request byte count from the
source file's disk size. Empty uploads receive an explicit empty-file message; the
20 MiB cap remains unchanged. `npm run test:upload-metadata` exercises the actual
browser file picker and private-adapter instruction endpoint with a synthetic tiny
PNG, while blocking provider traffic. It does not replace real hosted upload QA.
