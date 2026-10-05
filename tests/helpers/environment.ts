// Keep local verification independent of optional provider settings in .env.
// Check the database target before using this environment in a test process.
export function syntheticEnvironment(
  source: NodeJS.ProcessEnv,
  databaseURL: string,
): NodeJS.ProcessEnv {
  const env = { ...source }
  for (const key of Object.keys(env)) {
    if (/^(LUNIA_|VERCEL|BLOB_|RESEND_|POSTHOG_|PREVIEW_EDITOR_|CMS_ORIGIN$|MAIL_FROM$)/.test(key))
      delete env[key]
  }
  return {
    ...env,
    DATABASE_URL: databaseURL,
    PAYLOAD_SECRET: 'synthetic-verification-signing-secret-only',
    SEED_EMAIL: 'browser@example.test',
    SEED_PASSWORD: 'synthetic-browser-verification-password',
    LUNIA_CMS_PREVIEW: 'false',
    LUNIA_SHOWCASE: 'false',
    LUNIA_POSTHOG_ENABLED: 'false',
    LUNIA_RESEND_WEBHOOKS_ENABLED: 'false',
  }
}
