import { createHash } from 'node:crypto'

type Env = Record<string, string | undefined>

// Provider-owned metadata, never request Host or user input. Hash the entire ref so
// truncation and slash normalization cannot give distinct branches the same namespace.
export function previewNamespace(env: Env = process.env) {
  if (!env.VERCEL) return 'preview-media'
  if (!env.VERCEL_GIT_COMMIT_REF || !env.VERCEL_PROJECT_ID)
    throw new Error('Preview branch identity missing.')
  return `preview-media/${createHash('sha256')
    .update(`${env.VERCEL_PROJECT_ID}:${env.VERCEL_GIT_COMMIT_REF}`)
    .digest('hex')}`
}

export function assertMediaNamespace(key: string, prefix: string) {
  if (
    !key.startsWith(`${prefix}/`) ||
    key.split('/').some((part) => ['.', '..', ''].includes(part))
  )
    throw new Error('Media belongs to another preview namespace.')
  return key
}
