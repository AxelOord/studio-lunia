import policy from './preview-cleanup-policy.json' with { type: 'json' }
import { scope, requireCleanup } from './preview-cleanup-identity.mjs'
export { policy }

// Reviewable configuration, not a missing implementation. Runtime variables alone
// cannot activate the committed default. Tests supply owned synthetic policy/data.
export function requireApplyApproval(env, config = policy) {
  requireCleanup(config.executionEnabled === true, 'live-deletion-disabled')
  requireCleanup(
    env.GITHUB_ACTIONS === 'true' &&
      env.GITHUB_REPOSITORY === scope.repository &&
      env.GITHUB_REF === `refs/heads/${scope.defaultBranch}` &&
      /^[a-f0-9]{40}$/.test(env.GITHUB_SHA ?? '') &&
      env.LUNIA_PREVIEW_CLEANUP_APPROVED_SHA === env.GITHUB_SHA,
    'execution-approval-missing',
  )
  requireCleanup(
    typeof config.closedAfter === 'string' &&
      Number.isFinite(Date.parse(config.closedAfter)) &&
      Number.isSafeInteger(config.minimumClosedHours) &&
      config.minimumClosedHours >= 1 &&
      /^[a-z0-9-]{1,60}$/.test(config.neonProjectId ?? '') &&
      /^org-[A-Za-z0-9-]+$/.test(config.neonOrganizationId ?? '') &&
      /^br-[a-z0-9-]+$/.test(config.neonParentBranchId ?? '') &&
      config.exclusiveNativeProjectConfirmed === true,
    'activation-policy-incomplete',
  )
}

export function requireRetention(context, config, now = Date.now()) {
  requireCleanup(context.closedAt >= Date.parse(config.closedAfter), 'closure-before-activation')
  requireCleanup(
    now - context.closedAt >= config.minimumClosedHours * 3600000,
    'closure-settling-window',
  )
}
