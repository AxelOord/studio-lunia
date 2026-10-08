import { readFileSync, openSync, closeSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { policy, requireApplyApproval, requireRetention } from './preview-cleanup-approval.mjs'
import { cleanupAPI } from './preview-cleanup-api.mjs'
import {
  scope,
  planCleanup,
  executeCleanup,
  reconcileCleanup,
  prNumber,
  requireCleanup,
  reasonFor,
} from './preview-cleanup-core.mjs'

export const cleanupLockPath = join(tmpdir(), 'studio-lunia-preview-cleanup.lock')

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
  if (env.GITHUB_EVENT_NAME === 'schedule') return null
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

export async function main(
  args = process.argv.slice(2),
  env = process.env,
  fetcher = fetch,
  config = policy,
) {
  const mode = env.LUNIA_PREVIEW_CLEANUP_MODE ?? 'plan'
  requireCleanup(['plan', 'apply'].includes(mode), 'invalid-cleanup-mode')
  const apply = args.includes('--apply') || mode === 'apply'
  if (apply) requireApplyApproval(env, config)
  const remaining = args.filter((arg) => arg !== '--apply')
  requireCleanup(
    remaining.length === 0 || (remaining.length === 2 && remaining[0] === '--pr'),
    'invalid-arguments',
  )
  const number =
    env.GITHUB_ACTIONS === 'true'
      ? targetFromEvent(env, JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, 'utf8')))
      : prNumber(remaining[1])
  return withCleanupLock(cleanupLockPath, async () => {
    const api = cleanupAPI(env, fetcher, { apply, policy: config })
    const run = async (pr) => {
      const plan = await planCleanup(api, pr)
      if (!apply || plan.status === 'blocked') return plan
      try {
        requireRetention(plan.context, config)
      } catch (error) {
        return { status: 'blocked', reason: reasonFor(error), number: pr }
      }
      return executeCleanup(api, pr, (context) => requireRetention(context, config))
    }
    const result =
      number === null ? await reconcileCleanup(api, run, config.closedAfter) : await run(number)
    return { mode: apply ? 'apply' : 'plan-only', liveDeletionEnabled: apply, ...result }
  })
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2))
      if (
        ['blocked', 'incomplete', 'native-cleanup-pending'].includes(result.status) ||
        result.results?.some((item) => item.status === 'native-cleanup-pending')
      )
        process.exitCode = 1
    })
    .catch((error) => {
      console.error(
        JSON.stringify({ status: 'blocked', reason: reasonFor(error), liveDeletionEnabled: false }),
      )
      process.exitCode = 1
    })
}
