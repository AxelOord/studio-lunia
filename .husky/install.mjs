import { existsSync } from 'node:fs'

// Source exports, CI and dependency-only builds do not need local Git hooks.
if (
  process.env.HUSKY !== '0' &&
  !['true', '1'].includes(process.env.CI) &&
  !process.env.VERCEL &&
  process.env.NODE_ENV !== 'production' &&
  existsSync('.git')
) {
  const { default: install } = await import('husky')
  const error = install()
  if (error) throw new Error(error)
}
