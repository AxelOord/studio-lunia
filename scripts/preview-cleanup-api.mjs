import { scope, requireCleanup, CleanupError } from './preview-cleanup-core.mjs'

// No caller-controlled host, verb, team, project or repository. Provider response
// bodies/errors never enter the public journal, including authentication failures.
export function cleanupAPI(env = process.env, fetcher = fetch) {
  requireCleanup(
    env.GITHUB_TOKEN && env.LUNIA_VERCEL_CLEANUP_TOKEN,
    'management-read-access-missing',
  )
  async function read(provider, path, missingAllowed = false) {
    const github = provider === 'github'
    const host = github ? 'https://api.github.com' : 'https://api.vercel.com'
    const response = await fetcher(`${host}${path}`, {
      method: 'GET',
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
      headers: {
        Authorization: `Bearer ${github ? env.GITHUB_TOKEN : env.LUNIA_VERCEL_CLEANUP_TOKEN}`,
        Accept: 'application/json',
        ...(github ? { 'X-GitHub-Api-Version': '2022-11-28' } : {}),
      },
    })
    if (response.status === 404 && missingAllowed) return null
    requireCleanup(response.ok, `${provider}-read-failed`)
    return response.json()
  }
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
    async deleteDeployment() {
      throw new CleanupError('live-deletion-disabled')
    },
  }
}
