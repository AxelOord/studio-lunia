// Keep local verification independent of optional provider settings in .env.
// Check the database target before using this environment in a test process.
export function syntheticEnvironment(
  source: NodeJS.ProcessEnv,
  databaseURL: string,
): NodeJS.ProcessEnv {
  const env = { ...source }
  for (const key of Object.keys(env)) {
    if (
      /^(LUNIA_|VERCEL|BLOB_|RESEND_|POSTHOG_|PREVIEW_EDITOR_|DOTENV_|CMS_ORIGIN$|MAIL_FROM$)/.test(
        key,
      )
    )
      env[key] = ''
  }
  // Keep these present even when absent from the parent. Fresh dotenv/Next processes
  // otherwise restore deleted values from .env, .env.local or .env.production.
  for (const key of [
    'LUNIA_STORAGE',
    'LUNIA_PREVIEW_REVIEW',
    'BLOB_READ_WRITE_TOKEN',
    'RESEND_API_KEY',
    'RESEND_WEBHOOK_SECRET',
    'POSTHOG_PROJECT_TOKEN',
    'PREVIEW_EDITOR_EMAIL',
    'PREVIEW_EDITOR_PASSWORD',
    'CMS_ORIGIN',
    'MAIL_FROM',
    'VERCEL',
    'VERCEL_ENV',
    'VERCEL_PROJECT_ID',
    'VERCEL_BRANCH_URL',
    'VERCEL_URL',
    'VERCEL_GIT_REPO_OWNER',
    'VERCEL_GIT_REPO_SLUG',
    'VERCEL_GIT_COMMIT_REF',
    'DOTENV_KEY',
    'DOTENV_CONFIG_DOTENV_KEY',
    'DOTENV_CONFIG_OVERRIDE',
    'DOTENV_CONFIG_PATH',
    'DOTENV_CONFIG_ENCODING',
    'DOTENV_CONFIG_DEBUG',
  ])
    env[key] = ''
  return {
    ...env,
    DATABASE_URL: databaseURL,
    DATABASE_URL_UNPOOLED: databaseURL,
    TEST_DATABASE_URL: databaseURL,
    PAYLOAD_SECRET: 'synthetic-verification-signing-secret-only',
    SEED_EMAIL: 'browser@example.test',
    SEED_PASSWORD: 'synthetic-browser-verification-password',
    LUNIA_CMS_PREVIEW: 'false',
    LUNIA_SHOWCASE: 'false',
    LUNIA_POSTHOG_ENABLED: 'false',
    LUNIA_RESEND_WEBHOOKS_ENABLED: 'false',
  }
}
