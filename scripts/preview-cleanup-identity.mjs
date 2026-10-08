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
export function sameRepository(repo) {
  return repo?.id === scope.repositoryId && repo?.full_name === scope.repository
}
export function protectedRef(ref) {
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
export function timestamp(value) {
  const time = Date.parse(value)
  requireCleanup(Number.isFinite(time), 'invalid-pr-timestamp')
  return time
}
function sha(value) {
  requireCleanup(typeof value === 'string' && /^[a-f0-9]{40}$/.test(value), 'invalid-commit')
  return value
}
export function ownedProject(project) {
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
  requireCleanup(
    project.microfrontends == null ||
      (project.microfrontends.enabled === false &&
        Array.isArray(project.microfrontends.groupIds) &&
        project.microfrontends.groupIds.length === 0),
    'microfrontend-preview-protected',
  )
}
export function deploymentIdentity(deployment, context, commits) {
  const meta = deployment.meta
  requireCleanup(
    /^dpl_[A-Za-z0-9]+$/.test(deployment.id) &&
      deployment.projectId === scope.projectId &&
      (deployment.project === undefined || deployment.project.id === scope.projectId),
    'deployment-project-unverified',
  )
  requireCleanup(deployment.microfrontends == null, 'microfrontend-preview-protected')
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
  requireCleanup(
    String(meta.githubRepoId) === String(scope.repositoryId) ||
      String(deployment.gitSource?.repoId) === String(scope.repositoryId),
    'deployment-immutable-repository-missing',
  )
  const commit = sha(meta.githubCommitSha)
  requireCleanup(commits.has(commit), 'deployment-commit-outside-pr')
  requireCleanup(
    ['READY', 'ERROR', 'CANCELED'].includes(deployment.readyState),
    'deployment-active',
  )
  requireCleanup(
    Number.isSafeInteger(deployment.createdAt) &&
      deployment.createdAt > 0 &&
      deployment.createdAt <= (context.closedAt ?? Date.now()),
    'deployment-created-after-closure',
  )
  return {
    id: deployment.id,
    commit,
    createdAt: deployment.createdAt,
    state: deployment.readyState,
  }
}

export async function githubContext(api, number, registration = false) {
  const repository = await api.repository()
  requireCleanup(
    sameRepository(repository) && repository.default_branch === scope.defaultBranch,
    'repository-ownership-unverified',
  )
  const pr = await api.pullRequest(number)
  requireCleanup(
    pr?.number === number && (pr.state === 'closed' || (registration && pr.state === 'open')),
    'pr-not-closed',
  )
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
    closedAt: pr.state === 'closed' ? timestamp(pr.closed_at) : null,
    createdAt: timestamp(pr.created_at),
  }
  requireCleanup(context.createdAt <= (context.closedAt ?? Date.now()), 'invalid-pr-timestamp')
  const allPRs = await api.pullRequests()
  requireCleanup(Array.isArray(allPRs), 'invalid-pr-inventory')
  let matched = 0
  for (const other of allPRs) {
    requireCleanup(
      Number.isSafeInteger(other.number) &&
        ['open', 'closed'].includes(other.state) &&
        typeof other.head?.ref === 'string' &&
        typeof other.base?.ref === 'string' &&
        sameRepository(other.base.repo) &&
        (other.head.repo === null ||
          (Number.isSafeInteger(other.head.repo?.id) &&
            typeof other.head.repo.full_name === 'string' &&
            other.head.repo.full_name.includes('/'))),
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
    if (other.number === number) requireCleanup(other.state === pr.state, 'pr-reopened')
  }
  requireCleanup(matched === 1, 'pr-inventory-inconsistent')
  const branch = await api.branch(context.branch)
  if (registration)
    requireCleanup(
      (pr.state === 'closed' && branch === null) || branch?.object?.sha === context.head,
      'registration-ref-changed',
    )
  else requireCleanup(branch === null, 'git-branch-still-exists')
  const commitList = await api.commits(number)
  requireCleanup(
    Array.isArray(commitList) && commitList.length > 0 && commitList.length < 250,
    'incomplete-commit-history',
  )
  const commits = new Set(commitList.map((item) => sha(item.sha)))
  requireCleanup(commits.has(context.head), 'head-missing-from-pr-history')
  return { context, commits }
}
