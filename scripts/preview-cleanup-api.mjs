import { policy, requireApplyApproval } from './preview-cleanup-approval.mjs'
import { scope, requireCleanup, CleanupError } from './preview-cleanup-core.mjs'

// No caller-controlled host, verb, team, project or repository. Provider response
// bodies/errors never enter the public journal, including authentication failures.
export function cleanupAPI(env = process.env, fetcher = fetch, options = {}) {
  const config = structuredClone(options.policy ?? policy)
  const apply = options.apply === true
  if (apply) requireApplyApproval(env, config)
  requireCleanup(
    env.GITHUB_TOKEN && env.LUNIA_VERCEL_CLEANUP_TOKEN,
    'management-read-access-missing',
  )
  async function request(provider, path, missingAllowed = false, method = 'GET') {
    const github = provider === 'github'
    const host = github
      ? 'https://api.github.com'
      : provider === 'neon'
        ? 'https://console.neon.tech'
        : 'https://api.vercel.com'
    const token = github
      ? env.GITHUB_TOKEN
      : provider === 'neon'
        ? env.LUNIA_NEON_CLEANUP_READ_TOKEN
        : env.LUNIA_VERCEL_CLEANUP_TOKEN
    requireCleanup(token, 'management-read-access-missing')
    const response = await fetcher(`${host}${path}`, {
      method,
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(github ? { 'X-GitHub-Api-Version': '2022-11-28' } : {}),
      },
    })
    if (response.status === 404 && missingAllowed) return null
    requireCleanup(response.ok, `${provider}-${method === 'GET' ? 'read' : 'delete'}-failed`)
    return response.json()
  }
  const read = (provider, path, missingAllowed) => request(provider, path, missingAllowed)
  const repoPath = `/repos/${scope.repository}`
  async function githubList(path, maxPages = 20) {
    const items = []
    for (let page = 1; page <= maxPages; page++) {
      const data = await read(
        'github',
        `${repoPath}${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`,
      )
      requireCleanup(Array.isArray(data) && data.length <= 100, 'invalid-github-page')
      items.push(...data)
      if (data.length < 100) return items
    }
    throw new CleanupError('github-pagination-incomplete')
  }
  const teamQuery = `teamId=${scope.teamId}`
  return {
    repository: () => read('github', repoPath),
    project: () => read('vercel', `/v9/projects/${scope.projectId}?${teamQuery}`),
    pullRequest: (number) => read('github', `${repoPath}/pulls/${number}`),
    pullRequests: () => githubList('/pulls?state=all'),
    commits: (number) => githubList(`/pulls/${number}/commits`, 3),
    branch: (ref) => read('github', `${repoPath}/git/ref/heads/${encodeURIComponent(ref)}`, true),
    deployment: (id) => {
      requireCleanup(/^dpl_[A-Za-z0-9]+$/.test(id), 'invalid-deployment-id')
      return read('vercel', `/v13/deployments/${id}?${teamQuery}&withGitRepoInfo=true`, true)
    },
    async aliases(id) {
      requireCleanup(/^dpl_[A-Za-z0-9]+$/.test(id), 'invalid-deployment-id')
      const data = await read('vercel', `/v2/deployments/${id}/aliases?${teamQuery}`)
      // This endpoint returns all aliases, without pagination parameters. Refuse
      // future partial schemas rather than assuming the first page is complete.
      requireCleanup(Array.isArray(data.aliases) && !data.pagination, 'invalid-alias-inventory')
      return data.aliases
    },
    async deployments(branch) {
      const items = []
      let until
      const cursors = new Set()
      for (let page = 0; page < 20; page++) {
        const query = new URLSearchParams({
          teamId: scope.teamId,
          projectId: scope.projectId,
          branch,
          limit: '100',
        })
        if (until !== undefined) query.set('until', String(until))
        // Do not filter by target/state: production or in-flight peers must block cleanup.
        const data = await read('vercel', `/v7/deployments?${query}`)
        requireCleanup(
          Array.isArray(data.deployments) &&
            data.deployments.length <= 100 &&
            Number.isSafeInteger(data.pagination?.count) &&
            data.pagination.count === data.deployments.length,
          'invalid-vercel-page',
        )
        items.push(...data.deployments)
        const next = data.pagination.next
        if (next === null || next === undefined) return items
        requireCleanup(
          Number.isSafeInteger(next) &&
            next > 0 &&
            !cursors.has(next) &&
            (until === undefined || next < until),
          'invalid-vercel-cursor',
        )
        cursors.add(next)
        until = next
      }
      throw new CleanupError('vercel-pagination-incomplete')
    },
    async deleteDeployment(id) {
      requireCleanup(apply, 'live-deletion-disabled')
      requireApplyApproval(env, config)
      requireCleanup(/^dpl_[A-Za-z0-9]+$/.test(id), 'invalid-deployment-id')
      // No force, URL aliases, custom hosts, body or automatic write retries.
      const result = await request('vercel', `/v13/deployments/${id}?${teamQuery}`, true, 'DELETE')
      if (result === null) return 'already-absent'
      requireCleanup(result.uid === id && result.state === 'DELETED', 'invalid-delete-response')
      return 'deleted'
    },
    ...(config.neonProjectId
      ? {
          async nativeBranch(branch) {
            requireCleanup(/^[a-z0-9-]{1,60}$/.test(config.neonProjectId), 'invalid-neon-project')
            const path = `/api/v2/projects/${config.neonProjectId}`
            const project = await read('neon', path)
            requireCleanup(
              project.project?.id === config.neonProjectId &&
                project.project.org_id === config.neonOrganizationId,
              'native-project-unverified',
            )
            const branches = []
            const ids = new Set()
            const cursors = new Set()
            let cursor
            for (let page = 0; ; page++) {
              requireCleanup(page < 20, 'neon-pagination-incomplete')
              const query = new URLSearchParams({
                limit: '100',
                sort_by: 'created_at',
                sort_order: 'asc',
              })
              if (cursor) query.set('cursor', cursor)
              const data = await read('neon', `${path}/branches?${query}`)
              requireCleanup(
                Array.isArray(data.branches) &&
                  data.branches.length <= 100 &&
                  data.pagination &&
                  typeof data.pagination === 'object',
                'invalid-neon-page',
              )
              for (const item of data.branches) {
                requireCleanup(
                  /^br-[a-z0-9-]+$/.test(item.id) &&
                    item.project_id === config.neonProjectId &&
                    typeof item.name === 'string' &&
                    !ids.has(item.id),
                  'invalid-native-inventory',
                )
                ids.add(item.id)
                branches.push(item)
              }
              const next = data.pagination.next
              if (next === null || next === undefined) break
              requireCleanup(
                typeof next === 'string' &&
                  next.length > 0 &&
                  next.length <= 4096 &&
                  !cursors.has(next),
                'invalid-neon-cursor',
              )
              cursors.add(next)
              cursor = next
            }
            // Full ref inside the owner-reviewed exclusive native project. This name is
            // documented by Neon; it is never used for a DELETE on Neon.
            const matched = branches.filter((item) => item.name === `preview/${branch}`)
            requireCleanup(matched.length <= 1, 'native-branch-ambiguous')
            if (matched.length === 0) return null
            const found = matched[0]
            requireCleanup(
              found.default === false &&
                found.protected === false &&
                found.parent_id === config.neonParentBranchId &&
                !branches.some((item) => item.parent_id === found.id),
              'native-branch-protected-or-shared',
            )
            return {
              id: found.id,
              projectId: config.neonProjectId,
              name: found.name,
              parentId: found.parent_id,
            }
          },
        }
      : {}),
  }
}
