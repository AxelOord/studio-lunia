// No provider credentials or HTTP calls belong in this policy/controller module.
export const scope = Object.freeze({
  repository: 'AxelOord/studio-lunia',
  repositoryId: 1404604205,
  teamId: 'team_x4WNnHtFU7Uuf4bAgWyWXRLR',
  projectId: 'prj_RiVoPaLLyHgqAwR2Hivx3X2hRTAM',
  defaultBranch: 'master',
})

export class CleanupError extends Error {}
export function requireCleanup(condition, reason) {
  if (!condition) throw new CleanupError(reason)
}
export function reasonFor(error) {
  return error instanceof CleanupError ? error.message : 'provider-operation-failed'
}
export function prNumber(value) {
  requireCleanup(/^[1-9]\d{0,7}$/.test(String(value)), 'invalid-pr-number')
  return Number(value)
}
function sameRepository(repo) {
  return repo?.id === scope.repositoryId && repo?.full_name === scope.repository
}
function protectedRef(ref) {
  return (
    typeof ref !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/.test(ref) ||
    ref.includes('..') ||
    ref.includes('//') ||
    ref.endsWith('/') ||
    ref.endsWith('.lock') ||
    ref
      .split('/')
      .some((part) => ['main', 'master', 'develop', 'hosted-cms-preview'].includes(part)) ||
    /^(release|shared)\//.test(ref)
  )
}
function timestamp(value) {
  const time = Date.parse(value)
  requireCleanup(Number.isFinite(time), 'invalid-pr-timestamp')
  return time
}
function sha(value) {
  requireCleanup(typeof value === 'string' && /^[a-f0-9]{40}$/.test(value), 'invalid-commit')
  return value
}
function ownedProject(project) {
  requireCleanup(
    project?.id === scope.projectId &&
      project.accountId === scope.teamId &&
      project.link?.type === 'github' &&
      String(project.link.repoId) === String(scope.repositoryId) &&
      project.link.org === 'AxelOord' &&
      project.link.repo === 'studio-lunia' &&
      project.link.productionBranch === scope.defaultBranch,
    'project-ownership-unverified',
  )
}
function deploymentIdentity(deployment, context, commits) {
  const meta = deployment.meta
  requireCleanup(
    /^dpl_[A-Za-z0-9]+$/.test(deployment.id) &&
      deployment.projectId === scope.projectId &&
      (deployment.project === undefined || deployment.project.id === scope.projectId),
    'deployment-project-unverified',
  )
  requireCleanup(
    deployment.target === null && !deployment.customEnvironment && deployment.source === 'git',
    'deployment-is-not-native-preview',
  )
  requireCleanup(
    meta?.githubOrg === 'AxelOord' &&
      meta.githubRepo === 'studio-lunia' &&
      meta.githubCommitRef === context.branch &&
      (meta.githubRepoId === undefined ||
        String(meta.githubRepoId) === String(scope.repositoryId)) &&
      (meta.githubCommitOrg === undefined || meta.githubCommitOrg === 'AxelOord') &&
      (meta.githubCommitRepo === undefined || meta.githubCommitRepo === 'studio-lunia') &&
      (meta.githubPrId === undefined || String(meta.githubPrId) === String(context.number)),
    'deployment-pr-ownership-unverified',
  )
  if (deployment.gitSource) {
    requireCleanup(
      deployment.gitSource.type === 'github' &&
        String(deployment.gitSource.repoId) === String(scope.repositoryId) &&
        deployment.gitSource.ref === context.branch &&
        deployment.gitSource.sha === meta.githubCommitSha,
      'deployment-git-source-mismatch',
    )
  }
  const commit = sha(meta.githubCommitSha)
  requireCleanup(commits.has(commit), 'deployment-commit-outside-pr')
  requireCleanup(
    ['READY', 'ERROR', 'CANCELED'].includes(deployment.readyState),
    'deployment-active',
  )
  requireCleanup(
    Number.isSafeInteger(deployment.createdAt) &&
      deployment.createdAt > 0 &&
      deployment.createdAt <= context.closedAt,
    'deployment-created-after-closure',
  )
  return {
    id: deployment.id,
    commit,
    createdAt: deployment.createdAt,
    state: deployment.readyState,
  }
}

export async function planCleanup(api, number) {
  number = prNumber(number)
  try {
    const repository = await api.repository()
    requireCleanup(
      sameRepository(repository) && repository.default_branch === scope.defaultBranch,
      'repository-ownership-unverified',
    )
    const pr = await api.pullRequest(number)
    requireCleanup(pr?.number === number && pr.state === 'closed', 'pr-not-closed')
    requireCleanup(
      sameRepository(pr.base?.repo) && sameRepository(pr.head?.repo),
      'fork-or-missing-repository',
    )
    requireCleanup(pr.base.ref === 'develop', 'unsupported-pr-base')
    requireCleanup(!protectedRef(pr.head.ref), 'protected-or-invalid-branch')
    const context = {
      number,
      branch: pr.head.ref,
      head: sha(pr.head.sha),
      closedAt: timestamp(pr.closed_at),
      createdAt: timestamp(pr.created_at),
    }
    requireCleanup(context.createdAt <= context.closedAt, 'invalid-pr-timestamp')
    const allPRs = await api.pullRequests()
    requireCleanup(Array.isArray(allPRs), 'invalid-pr-inventory')
    let matched = 0
    for (const other of allPRs) {
      requireCleanup(
        Number.isSafeInteger(other.number) && other.head && other.base,
        'invalid-pr-inventory',
      )
      // A missing repo for a same-name ref is ambiguous (for example a deleted fork).
      if (
        other.head.ref === context.branch &&
        (!other.head.repo || sameRepository(other.head.repo))
      ) {
        requireCleanup(other.number === number, 'branch-shared-with-another-pr')
        matched++
      }
      requireCleanup(
        !(other.state === 'open' && other.base.ref === context.branch),
        'branch-used-by-open-pr',
      )
      if (other.number === number) requireCleanup(other.state === 'closed', 'pr-reopened')
    }
    requireCleanup(matched === 1, 'pr-inventory-inconsistent')
    requireCleanup((await api.branch(context.branch)) === null, 'git-branch-still-exists')
    const commitList = await api.commits(number)
    requireCleanup(
      Array.isArray(commitList) && commitList.length > 0 && commitList.length < 250,
      'incomplete-commit-history',
    )
    const commits = new Set(commitList.map((item) => sha(item.sha)))
    requireCleanup(commits.has(context.head), 'head-missing-from-pr-history')
    ownedProject(await api.project())
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
      deployments.push(deploymentIdentity(detail, context, commits))
    }
    deployments.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
    return { status: 'planned', scope, context, deployments, nativeDatabase: 'unverified' }
  } catch (error) {
    return { status: 'blocked', reason: reasonFor(error), number }
  }
}

// The live adapter cannot delete. This state machine is exercised with an owned fake
// provider until a separate operational review approves a live implementation.
export async function executeCleanup(api, number) {
  const journal = []
  let phase = 'planning'
  try {
    const plan = await planCleanup(api, number)
    requireCleanup(plan.status === 'planned', plan.reason)
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
      phase = 'deleting'
      const result = await api.deleteDeployment(candidate.id)
      requireCleanup(result === 'deleted' || result === 'already-absent', 'invalid-delete-response')
      journal.push({ id: candidate.id, result })
    }
    phase = 'verifying'
    const final = await planCleanup(api, number)
    requireCleanup(final.status === 'planned', final.reason)
    requireCleanup(JSON.stringify(final.context) === JSON.stringify(plan.context), 'pr-changed')
    requireCleanup(final.deployments.length === 0, 'deployments-remain')
    return { status: 'deployments-absent', journal, nativeDatabase: 'unverified' }
  } catch (error) {
    return {
      status: 'incomplete',
      phase,
      reason: reasonFor(error),
      journal,
      nativeDatabase: 'unverified',
    }
  }
}
