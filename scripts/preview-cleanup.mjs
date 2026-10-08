import { readFileSync, openSync, closeSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { cleanupAPI } from './preview-cleanup-api.mjs'
import { scope, planCleanup, prNumber, requireCleanup, reasonFor } from './preview-cleanup-core.mjs'

export function targetFromEvent(env, event) {
  requireCleanup(
    env.GITHUB_REPOSITORY === scope.repository &&
      event.repository?.id === scope.repositoryId &&
      event.repository.full_name === scope.repository,
    'wrong-event-repository',
  )
  requireCleanup(
    event.repository.default_branch === scope.defaultBranch &&
      env.GITHUB_REF === `refs/heads/${scope.defaultBranch}`,
    'untrusted-workflow-ref',
  )
  if (env.GITHUB_EVENT_NAME === 'workflow_dispatch') return prNumber(event.inputs?.pr_number)
  requireCleanup(
    env.GITHUB_EVENT_NAME === 'pull_request_target' && event.action === 'closed',
    'unsupported-event',
  )
  requireCleanup(
    event.pull_request?.head?.repo?.id === scope.repositoryId &&
      event.pull_request.head.repo.full_name === scope.repository,
    'fork-event',
  )
  return prNumber(event.number)
}

export async function withCleanupLock(path, work) {
  let descriptor
  try {
    descriptor = openSync(path, 'wx', 0o600)
  } catch {
    throw new Error('Cleanup is already running or the exclusive lock is unavailable')
  }
  try {
    return await work()
  } finally {
    closeSync(descriptor)
    unlinkSync(path)
  }
}

export async function main(args = process.argv.slice(2), env = process.env) {
  // No runtime switch, environment variable or workflow input enables deletion.
  requireCleanup(!args.includes('--apply'), 'live-deletion-disabled')
  requireCleanup(
    args.length === 0 || (args.length === 2 && args[0] === '--pr'),
    'invalid-arguments',
  )
  const number =
    env.GITHUB_ACTIONS === 'true'
      ? targetFromEvent(env, JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, 'utf8')))
      : prNumber(args[1])
  const path = join(tmpdir(), 'studio-lunia-preview-cleanup.lock')
  return withCleanupLock(path, () => planCleanup(cleanupAPI(env), number))
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .then((result) => {
      console.log(
        JSON.stringify({ mode: 'plan-only', liveDeletionEnabled: false, ...result }, null, 2),
      )
      if (result.status === 'blocked') process.exitCode = 1
    })
    .catch((error) => {
      console.error(
        JSON.stringify({ status: 'blocked', reason: reasonFor(error), liveDeletionEnabled: false }),
      )
      process.exitCode = 1
    })
}
