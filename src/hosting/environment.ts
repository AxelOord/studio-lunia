type Env = Record<string, string | undefined>
export const PREVIEW_PROJECT = 'prj_RiVoPaLLyHgqAwR2Hivx3X2hRTAM'
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024
export const MAX_IMAGE_PIXELS = 40_000_000

export function deploymentMode(env: Env) {
  if (env.VERCEL_ENV === 'production') throw new Error('Production deployment remains disabled.')
  if (env.LUNIA_SHOWCASE === 'true') {
    if (env.LUNIA_CMS_PREVIEW === 'true') throw new Error('CMS preview cannot use showcase mode.')
    return 'showcase' as const
  }
  if (!env.VERCEL) {
    if (env.LUNIA_CMS_PREVIEW === 'true')
      throw new Error('Hosted preview mode requires the Vercel preview environment.')
    return 'local' as const
  }
  if (
    env.VERCEL_ENV !== 'preview' ||
    env.VERCEL_PROJECT_ID !== PREVIEW_PROJECT ||
    env.LUNIA_CMS_PREVIEW !== 'true' ||
    env.VERCEL_GIT_REPO_OWNER !== 'AxelOord' ||
    env.VERCEL_GIT_REPO_SLUG !== 'studio-lunia' ||
    !env.VERCEL_GIT_COMMIT_REF ||
    ['master', 'main', 'develop'].includes(env.VERCEL_GIT_COMMIT_REF) ||
    env.LUNIA_PREVIEW_REVIEW !== 'approved'
  )
    throw new Error('Hosted CMS preview is not approved for this project and branch.')
  if (env.LUNIA_STORAGE !== 'private-blob')
    throw new Error('Hosted preview requires private Blob storage.')
  for (const name of [
    'DATABASE_URL',
    'PAYLOAD_SECRET',
    'BLOB_READ_WRITE_TOKEN',
    'RESEND_API_KEY',
    'MAIL_FROM',
    'PREVIEW_EDITOR_EMAIL',
  ]) {
    if (!env[name]) throw new Error(`Missing required preview setting: ${name}`)
  }
  if ((env.PAYLOAD_SECRET?.length ?? 0) < 32) throw new Error('Preview secret is too short.')
  const database = safeURL(env.DATABASE_URL!)
  if (
    !['postgres:', 'postgresql:'].includes(database.protocol) ||
    !['require', 'verify-full'].includes(database.searchParams.get('sslmode') ?? '')
  )
    throw new Error('Preview database requires PostgreSQL over TLS.')
  cmsOrigin(env)
  return 'preview' as const
}

export function approvedOrigin(value: string, hosted = false) {
  const url = safeURL(value)
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/')
    throw new Error('CMS_ORIGIN must be an origin without a path or credentials.')
  if (
    hosted
      ? url.protocol !== 'https:' || !url.hostname.endsWith('.vercel.app')
      : !['http:', 'https:'].includes(url.protocol)
  )
    throw new Error('Invalid CMS origin.')
  return url.origin
}

export function resetEmail(origin: string, token: string) {
  const url = `${approvedOrigin(origin)}/admin/reset/${encodeURIComponent(token)}`
  return `<p>A password reset was requested for Studio Lunia.</p><p><a href="${url}">Reset your password</a></p><p>This link expires in 15 minutes. Ignore this message if you did not request it.</p>`
}

function safeURL(value: string) {
  try {
    return new URL(value)
  } catch {
    throw new Error('Invalid URL configuration; check the setting without logging its value.')
  }
}

// A stable branch alias preserves editor navigation across rebuilds. Vercel owns
// this value; do not reconstruct aliases (provider truncation rules can change).
export function cmsOrigin(env: Env = process.env) {
  if (env.VERCEL) {
    if (!env.VERCEL_BRANCH_URL) throw new Error('Vercel branch URL is required for CMS preview.')
    return approvedOrigin(`https://${env.VERCEL_BRANCH_URL}`, true)
  }
  return approvedOrigin(env.CMS_ORIGIN || 'http://localhost:3000')
}

export function cmsAllowedOrigins(env: Env = process.env) {
  const origins = [cmsOrigin(env)]
  if (env.VERCEL && env.VERCEL_URL) origins.push(approvedOrigin(`https://${env.VERCEL_URL}`, true))
  return [...new Set(origins)]
}
