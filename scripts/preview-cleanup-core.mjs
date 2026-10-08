import {
  scope,
  requireCleanup,
  reasonFor,
  prNumber,
  ownedProject,
  deploymentIdentity,
  githubContext,
  sameRepository,
  protectedRef,
  timestamp,
} from './preview-cleanup-identity.mjs'
export {
  scope,
  requireCleanup,
  reasonFor,
  prNumber,
  CleanupError,
} from './preview-cleanup-identity.mjs'
import { isDeepStrictEqual } from 'node:util'
import { emptyOwnership, ownershipForPR, verifyOwnedAliases } from './preview-ownership.mjs'

export async function planCleanup(api, number) {
  number = prNumber(number)
  try {
    const { context, commits } = await githubContext(api, number)
    const ownership = ownershipForPR(
      api.ownershipManifest ? await api.ownershipManifest() : emptyOwnership(),
      context,
      commits,
    )
    const project = await api.project()
    ownedProject(project)
    requireCleanup(
      project.targets && typeof project.targets === 'object' && !Array.isArray(project.targets),
      'project-targets-unverified',
    )
    requireCleanup(
      Object.values(project.targets).every(
        (target) => target && /^dpl_[A-Za-z0-9]+$/.test(target.id),
      ),
      'project-targets-unverified',
    )
    const inventory = await api.deployments(context.branch)
    requireCleanup(Array.isArray(inventory), 'invalid-deployment-inventory')
    const deployments = []
    const ids = new Set()
    for (const item of inventory) {
      requireCleanup(/^dpl_[A-Za-z0-9]+$/.test(item.uid), 'invalid-deployment-id')
      requireCleanup(!ids.has(item.uid), 'duplicate-deployment-inventory')
      ids.add(item.uid)
      // A deployment can disappear between listing and detail: reconcile by exact ID.
      const detail = await api.deployment(item.uid)
      if (detail === null) continue
      requireCleanup(detail.id === item.uid, 'deployment-id-mismatch')
      const identity = deploymentIdentity(detail, context, commits)
      requireCleanup(
        !Object.values(project.targets).some((target) => target?.id === item.uid),
        'deployment-is-project-target',
      )
      const aliases = await api.aliases(item.uid)
      requireCleanup(Array.isArray(aliases), 'invalid-alias-inventory')
      if (aliases.length > 0)
        identity.aliases = await verifyOwnedAliases(
          api,
          project,
          detail,
          identity,
          aliases,
          ownership.records,
        )
      deployments.push(identity)
    }
    deployments.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
    let nativeBranch = api.nativeBranch ? await api.nativeBranch(context.branch) : undefined
    const nativeBranchAtName = nativeBranch
    if (api.nativeBranch && deployments.length > 0)
      requireCleanup(nativeBranch !== null, 'native-branch-missing-before-deletion')
    if (ownership.nativeBranch) {
      requireCleanup(typeof api.nativeBranchById === 'function', 'native-identity-read-unavailable')
      requireCleanup(
        nativeBranch == null || isDeepStrictEqual(nativeBranch, ownership.nativeBranch),
        'ownership-native-conflict',
      )
      // A trusted saved ID survives name changes and delayed cleanup across runs.
      // Validate the configured project via the adapter before accepting it.
      const observed = await api.nativeBranchById(
        ownership.nativeBranch.id,
        ownership.nativeBranch.projectId,
      )
      requireCleanup(
        observed === null ||
          (observed?.id === ownership.nativeBranch.id &&
            observed.projectId === ownership.nativeBranch.projectId),
        'native-branch-id-unverified',
      )
      requireCleanup(nativeBranchAtName == null || observed !== null, 'native-observation-conflict')
      nativeBranch = ownership.nativeBranch
    }
    // Provider reads may take time. Recheck Git ownership last, immediately before
    // returning the fresh plan to the executor (cross-provider atomicity is unavailable).
    const latest = await githubContext(api, number)
    requireCleanup(JSON.stringify(latest.context) === JSON.stringify(context), 'pr-changed')
    requireCleanup(
      deployments.every((item) => latest.commits.has(item.commit)),
      'deployment-commit-outside-pr',
    )
    return {
      status: 'planned',
      scope,
      context,
      deployments,
      nativeBranch,
      nativeBranchAtName,
      nativeDatabase: 'unverified',
    }
  } catch (error) {
    return { status: 'blocked', reason: reasonFor(error), number }
  }
}

// The CLI and production adapter require separate activation approval. Tests use
// owned fake transports; this controller never selects a host or handles credentials.
export async function executeCleanup(api, number, beforeDelete = () => {}) {
  const journal = []
  let phase = 'planning'
  let nativeBranchId
  try {
    const plan = await planCleanup(api, number)
    requireCleanup(plan.status === 'planned', plan.reason)
    nativeBranchId = plan.nativeBranch?.id
    if (nativeBranchId)
      requireCleanup(typeof api.nativeBranchById === 'function', 'native-identity-read-unavailable')
    beforeDelete(plan.context)
    const original = new Map(plan.deployments.map((item) => [item.id, JSON.stringify(item)]))
    for (const candidate of plan.deployments) {
      phase = 'revalidating'
      const current = await planCleanup(api, number)
      requireCleanup(current.status === 'planned', current.reason)
      requireCleanup(JSON.stringify(current.context) === JSON.stringify(plan.context), 'pr-changed')
      for (const item of current.deployments) {
        requireCleanup(
          original.get(item.id) === JSON.stringify(item),
          'deployment-inventory-changed',
        )
      }
      if (!current.deployments.some((item) => item.id === candidate.id)) {
        journal.push({ id: candidate.id, result: 'already-absent' })
        continue
      }
      requireCleanup(
        JSON.stringify(current.nativeBranch) === JSON.stringify(plan.nativeBranch),
        'native-branch-changed',
      )
      beforeDelete(current.context)
      phase = 'deleting'
      const result = await api.deleteDeployment(candidate.id)
      requireCleanup(result === 'deleted' || result === 'already-absent', 'invalid-delete-response')
      journal.push({ id: candidate.id, result })
      phase = 'confirming-deletion'
      requireCleanup((await api.deployment(candidate.id)) === null, 'deletion-not-observed')
    }
    phase = 'verifying'
    const final = await planCleanup(api, number)
    requireCleanup(final.status === 'planned', final.reason)
    requireCleanup(JSON.stringify(final.context) === JSON.stringify(plan.context), 'pr-changed')
    requireCleanup(final.deployments.length === 0, 'deployments-remain')
    if (nativeBranchId) {
      requireCleanup(
        final.nativeBranch === null ||
          JSON.stringify(final.nativeBranch) === JSON.stringify(plan.nativeBranch),
        'native-branch-changed',
      )
      const observed = await api.nativeBranchById(nativeBranchId)
      requireCleanup(
        observed === null ||
          (observed?.id === nativeBranchId && observed.projectId === plan.nativeBranch.projectId),
        'native-branch-id-unverified',
      )
      // A missing name is not proof: the original branch can have been renamed.
      // Conflicting list/detail reads are also uncertainty, not success.
      requireCleanup(
        observed !== null || final.nativeBranchAtName === null,
        'native-observation-conflict',
      )
      return {
        status: observed === null ? 'cleanup-verified' : 'native-cleanup-pending',
        journal,
        nativeBranchId,
        nativeDatabase: observed === null ? 'absent' : 'retained',
      }
    }
    // No trusted identity persists across runs. A later name-only miss must not
    // upgrade a previous pending/unknown outcome to verified deletion.
    return { status: 'deployments-absent', journal, nativeDatabase: 'unverified' }
  } catch (error) {
    return {
      status: 'incomplete',
      phase,
      reason: reasonFor(error),
      journal,
      nativeBranchId,
      nativeDatabase: 'unverified',
    }
  }
}

// Recover missed/queued close events and delayed Git-ref removal without storing
// stale deletion plans. All candidates still pass the same canonical guards.
export async function reconcileCleanup(api, run, closedAfter) {
  const cutoff = Date.parse(closedAfter)
  requireCleanup(Number.isFinite(cutoff), 'reconciliation-cutoff-missing')
  const prs = await api.pullRequests()
  requireCleanup(Array.isArray(prs), 'invalid-pr-inventory')
  const numbers = new Set()
  for (const pr of prs) {
    requireCleanup(
      Number.isSafeInteger(pr.number) && !numbers.has(pr.number),
      'invalid-pr-inventory',
    )
    numbers.add(pr.number)
  }
  // Validate/filter the entire batch before any writes so a malformed later PR
  // cannot discard an earlier PR's progress journal.
  const candidates = prs.filter((pr) => {
    requireCleanup(
      ['open', 'closed'].includes(pr.state) && pr.head && pr.base,
      'invalid-pr-inventory',
    )
    if (
      pr.state !== 'closed' ||
      !sameRepository(pr.head.repo) ||
      !sameRepository(pr.base.repo) ||
      pr.base.ref !== 'develop' ||
      protectedRef(pr.head.ref)
    )
      return false
    return timestamp(pr.closed_at) >= cutoff
  })
  const results = []
  for (const pr of candidates) {
    let result
    try {
      result = await run(pr.number)
    } catch (error) {
      result = { status: 'incomplete', reason: reasonFor(error), phase: 'reconciling' }
    }
    if (
      result.status === 'blocked' &&
      /failed|incomplete|^invalid-|^duplicate-|unverified/.test(result.reason ?? '')
    )
      result = { ...result, status: 'incomplete', phase: 'planning' }
    results.push({ number: pr.number, ...result })
    // Policy blocks are eligible for a future fresh run; uncertain writes stop now.
    if (result.status === 'incomplete') return { status: 'incomplete', results }
  }
  return { status: 'reconciled', results }
}
