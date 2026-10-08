import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { scope, planCleanup, executeCleanup } from '../scripts/preview-cleanup-core.mjs'
import { cleanupAPI } from '../scripts/preview-cleanup-api.mjs'
import { targetFromEvent, withCleanupLock } from '../scripts/preview-cleanup.mjs'

const head = 'a'.repeat(40)
const previous = 'b'.repeat(40)
function fixture() {
  const repo = { id: scope.repositoryId, full_name: scope.repository, default_branch: 'master' }
  const pr = {
    number: 91,
    state: 'closed',
    merged: false,
    created_at: '2026-01-01T00:00:00Z',
    closed_at: '2026-01-03T00:00:00Z',
    head: { repo: { ...repo }, ref: 'feat/owned-preview', sha: head },
    base: { repo: { ...repo }, ref: 'develop' },
  }
  const project = {
    id: scope.projectId,
    accountId: scope.teamId,
    link: {
      type: 'github',
      repoId: scope.repositoryId,
      org: 'AxelOord',
      repo: 'studio-lunia',
      productionBranch: 'master',
    },
  }
  function deployment(id, commit, createdAt) {
    return {
      id,
      projectId: scope.projectId,
      target: null,
      source: 'git',
      readyState: 'READY',
      createdAt,
      meta: {
        githubOrg: 'AxelOord',
        githubRepo: 'studio-lunia',
        githubCommitRef: pr.head.ref,
        githubCommitSha: commit,
      },
      gitSource: { type: 'github', repoId: scope.repositoryId, ref: pr.head.ref, sha: commit },
    }
  }
  const rows = new Map([
    ['dpl_old', deployment('dpl_old', previous, Date.parse('2026-01-01T12:00:00Z'))],
    ['dpl_last', deployment('dpl_last', head, Date.parse('2026-01-02T00:00:00Z'))],
  ])
  const state = {
    repo,
    pr,
    project,
    rows,
    prs: [pr],
    branch: null,
    commits: [{ sha: previous }, { sha: head }],
    deleted: [],
  }
  const api = {
    repository: async () => structuredClone(state.repo),
    project: async () => structuredClone(state.project),
    pullRequest: async () => structuredClone(state.pr),
    pullRequests: async () => structuredClone(state.prs),
    branch: async () => structuredClone(state.branch),
    commits: async () => structuredClone(state.commits),
    deployments: async () => [...rows.keys()].map((uid) => ({ uid })),
    deployment: async (id) => structuredClone(rows.get(id) ?? null),
    deleteDeployment: async (id) => {
      state.deleted.push(id)
      return rows.delete(id) ? 'deleted' : 'already-absent'
    },
  }
  return { state, api }
}

for (const merged of [false, true])
  test(`plans a ${merged ? 'merged' : 'closed'} sole PR including pushes without PR metadata`, async () => {
    const { state, api } = fixture()
    state.pr.merged = merged
    const plan = await planCleanup(api, 91)
    assert.equal(plan.status, 'planned')
    assert.deepEqual(
      plan.deployments.map((d) => d.id),
      ['dpl_old', 'dpl_last'],
    )
    assert.deepEqual(state.deleted, [])
    assert.equal(plan.nativeDatabase, 'unverified')
  })

const blockedCases = [
  ['wrong repository ID', (s) => s.repo.id++, 'repository-ownership-unverified'],
  [
    'changed default branch',
    (s) => (s.repo.default_branch = 'develop'),
    'repository-ownership-unverified',
  ],
  ['wrong Vercel project', (s) => (s.project.id = 'prj_foreign'), 'project-ownership-unverified'],
  ['wrong team', (s) => (s.project.accountId = 'team_foreign'), 'project-ownership-unverified'],
  [
    'different connected repository',
    (s) => s.project.link.repoId++,
    'project-ownership-unverified',
  ],
  ['missing connected repository', (s) => delete s.project.link, 'project-ownership-unverified'],
  ['open PR', (s) => (s.pr.state = 'open'), 'pr-not-closed'],
  [
    'fork with matching branch name',
    (s) => (s.pr.head.repo = { id: 9, full_name: 'fork/studio-lunia' }),
    'fork-or-missing-repository',
  ],
  ['deleted head repository', (s) => (s.pr.head.repo = null), 'fork-or-missing-repository'],
  ['wrong base repository', (s) => s.pr.base.repo.id++, 'fork-or-missing-repository'],
  ['release PR', (s) => (s.pr.base.ref = 'master'), 'unsupported-pr-base'],
  [
    'existing Git branch',
    (s) => (s.branch = { ref: 'refs/heads/feat/owned-preview' }),
    'git-branch-still-exists',
  ],
  [
    'shared with closed PR',
    (s) => s.prs.push({ ...s.pr, number: 92 }),
    'branch-shared-with-another-pr',
  ],
  [
    'shared with open PR',
    (s) => s.prs.push({ ...s.pr, number: 92, state: 'open' }),
    'branch-shared-with-another-pr',
  ],
  [
    'open dependent PR',
    (s) =>
      s.prs.push({
        ...s.pr,
        number: 92,
        state: 'open',
        head: { ...s.pr.head, ref: 'feat/child' },
        base: { ...s.pr.base, ref: s.pr.head.ref },
      }),
    'branch-used-by-open-pr',
  ],
  ['incomplete PR inventory', (s) => (s.prs = []), 'pr-inventory-inconsistent'],
  [
    'capped commit history',
    (s) => (s.commits = Array.from({ length: 250 }, () => ({ sha: head }))),
    'incomplete-commit-history',
  ],
  ['missing head commit', (s) => (s.commits = [{ sha: previous }]), 'head-missing-from-pr-history'],
]
for (const [label, mutate, reason] of blockedCases)
  test(`blocks ${label} before deleting anything`, async () => {
    const { state, api } = fixture()
    mutate(state)
    assert.equal((await planCleanup(api, 91)).reason, reason)
    assert.deepEqual(state.deleted, [])
  })
for (const branch of [
  'main',
  'master',
  'develop',
  'hosted-cms-preview',
  'feature/hosted-cms-preview',
  'shared/demo',
  'release/v0.1.0',
  'feat/../main',
  'feat//other',
  'feat/a\n',
])
  test(`protects full branch ${JSON.stringify(branch)}`, async () => {
    const { state, api } = fixture()
    state.pr.head.ref = branch
    assert.equal((await planCleanup(api, 91)).reason, 'protected-or-invalid-branch')
  })
const badDeployments = [
  ['other project', (d) => (d.projectId = 'prj_other')],
  ['production', (d) => (d.target = 'production')],
  ['custom target', (d) => (d.customEnvironment = { id: 'env_other' })],
  ['missing target', (d) => delete d.target],
  ['CLI deployment', (d) => (d.source = 'cli')],
  ['other full ref', (d) => (d.meta.githubCommitRef += '-other')],
  ['missing Git ownership', (d) => delete d.meta.githubOrg],
  ['other PR ID', (d) => (d.meta.githubPrId = '92')],
  ['fork source', (d) => (d.meta.githubCommitOrg = 'fork')],
  ['mismatched Git repository', (d) => d.gitSource.repoId++],
  [
    'commit outside PR',
    (d) => {
      d.meta.githubCommitSha = 'c'.repeat(40)
      d.gitSource.sha = 'c'.repeat(40)
    },
  ],
  ['build in progress', (d) => (d.readyState = 'BUILDING')],
  ['post-close deployment', (d) => (d.createdAt = Date.parse('2026-01-04T00:00:00Z'))],
]
for (const [label, mutate] of badDeployments)
  test(`blocks entire plan for ${label}`, async () => {
    const { state, api } = fixture()
    mutate(state.rows.get('dpl_last'))
    const result = await executeCleanup(api, 91)
    assert.equal(result.status, 'incomplete')
    assert.deepEqual(state.deleted, [])
  })

test('simulated cleanup removes the final deployment and repeated execution is a no-op', async () => {
  const { state, api } = fixture()
  const first = await executeCleanup(api, 91)
  assert.equal(first.status, 'deployments-absent')
  assert.equal(first.nativeDatabase, 'unverified')
  assert.deepEqual(state.deleted, ['dpl_old', 'dpl_last'])
  assert.deepEqual((await executeCleanup(api, 91)).journal, [])
})
test('already missing deployment and delete 404 are idempotent', async () => {
  const { state, api } = fixture()
  api.deleteDeployment = async (id) => {
    state.rows.delete(id)
    return 'already-absent'
  }
  const result = await executeCleanup(api, 91)
  assert.equal(result.status, 'deployments-absent')
  assert.ok(result.journal.every((item) => item.result === 'already-absent'))
})
test('a detail 404 after inventory is absence, not a broader search', async () => {
  const { api } = fixture()
  api.deployment = async () => null
  assert.deepEqual((await planCleanup(api, 91)).deployments, [])
})
for (const [label, change] of [
  ['reopened PR', (s) => (s.pr.state = 'open')],
  ['branch recreated even at same SHA', (s) => (s.branch = { object: { sha: head } })],
  ['new shared PR', (s) => s.prs.push({ ...s.pr, number: 92 })],
  ['changed closure generation', (s) => (s.pr.closed_at = '2026-01-04T00:00:00Z')],
  ['reassigned project', (s) => s.project.link.repoId++],
  [
    'new deployment',
    (s) => s.rows.set('dpl_new', { ...structuredClone(s.rows.get('dpl_last')), id: 'dpl_new' }),
  ],
  ['promoted remaining deployment', (s) => (s.rows.get('dpl_last').target = 'production')],
])
  test(`stops after partial progress for ${label}`, async () => {
    const { state, api } = fixture()
    const remove = api.deleteDeployment
    api.deleteDeployment = async (id) => {
      const result = await remove(id)
      change(state)
      return result
    }
    const result = await executeCleanup(api, 91)
    assert.equal(result.status, 'incomplete')
    assert.deepEqual(state.deleted, ['dpl_old'])
    assert.ok(state.rows.has('dpl_last'))
    assert.equal(result.journal.length, 1)
  })
test('new deployment after final deletion prevents completion', async () => {
  const { state, api } = fixture()
  const late = structuredClone(state.rows.get('dpl_last'))
  const remove = api.deleteDeployment
  api.deleteDeployment = async (id) => {
    const result = await remove(id)
    if (id === 'dpl_last') state.rows.set('dpl_late', { ...late, id: 'dpl_late' })
    return result
  }
  const result = await executeCleanup(api, 91)
  assert.equal(result.status, 'incomplete')
  assert.equal(result.reason, 'deployments-remain')
  assert.ok(state.rows.has('dpl_late'))
})
test('lost delete response stops without retry and next fresh run reconciles remaining IDs', async () => {
  const { state, api } = fixture()
  const remove = api.deleteDeployment
  api.deleteDeployment = async (id) => {
    await remove(id)
    throw new Error('secret provider token')
  }
  const result = await executeCleanup(api, 91)
  assert.equal(result.status, 'incomplete')
  assert.equal(result.phase, 'deleting')
  assert.equal(JSON.stringify(result).includes('secret'), false)
  assert.deepEqual(state.deleted, ['dpl_old'])
  api.deleteDeployment = remove
  assert.equal((await executeCleanup(api, 91)).status, 'deployments-absent')
  assert.deepEqual(state.deleted, ['dpl_old', 'dpl_last'])
})
test('read failure during revalidation preserves prior journal without another write', async () => {
  const { state, api } = fixture()
  const remove = api.deleteDeployment
  api.deleteDeployment = async (id) => {
    const result = await remove(id)
    api.project = async () => {
      throw new Error('sensitive body')
    }
    return result
  }
  const result = await executeCleanup(api, 91)
  assert.equal(result.reason, 'provider-operation-failed')
  assert.deepEqual(state.deleted, ['dpl_old'])
  assert.equal(result.journal.length, 1)
})
test('an independent deletion during revalidation is safe', async () => {
  const { state, api } = fixture()
  const remove = api.deleteDeployment
  api.deleteDeployment = async (id) => {
    const result = await remove(id)
    state.rows.delete('dpl_last')
    return result
  }
  const result = await executeCleanup(api, 91)
  assert.equal(result.status, 'deployments-absent')
  assert.deepEqual(result.journal.at(-1), { id: 'dpl_last', result: 'already-absent' })
})

const tokens = { GITHUB_TOKEN: 'synthetic-github', LUNIA_VERCEL_CLEANUP_TOKEN: 'synthetic-vercel' }
const json = (value, status = 200) => new Response(JSON.stringify(value), { status })
test('HTTP adapter scopes every request, paginates and never follows caller URLs', async () => {
  const calls = []
  const api = cleanupAPI(tokens, async (url, options) => {
    const u = new URL(url)
    calls.push({ u, options })
    if (u.hostname === 'api.github.com')
      return json(
        u.searchParams.get('page') === '1'
          ? Array.from({ length: 100 }, (_, i) => ({ number: i + 1 }))
          : [],
      )
    return json({
      deployments: [{ uid: u.searchParams.has('until') ? 'dpl_second' : 'dpl_first' }],
      pagination: { count: 1, next: u.searchParams.has('until') ? null : 123 },
    })
  })
  assert.equal((await api.pullRequests()).length, 100)
  assert.deepEqual(
    (await api.deployments('feat/a+b')).map((d) => d.uid),
    ['dpl_first', 'dpl_second'],
  )
  for (const { u, options } of calls) {
    assert.equal(options.method, 'GET')
    assert.equal(options.redirect, 'error')
    assert.ok(options.signal instanceof AbortSignal)
    if (u.hostname === 'api.vercel.com') {
      assert.equal(u.searchParams.get('teamId'), scope.teamId)
      assert.equal(u.searchParams.get('projectId'), scope.projectId)
      assert.equal(u.searchParams.get('branch'), 'feat/a+b')
      assert.equal(u.searchParams.has('target'), false)
      assert.equal(u.searchParams.has('state'), false)
    } else assert.equal(u.pathname, `/repos/${scope.repository}/pulls`)
  }
  const before = calls.length
  await assert.rejects(api.deleteDeployment('dpl_first'), /live-deletion-disabled/)
  assert.equal(calls.length, before)
})
test('production adapter and core compose into a complete read-only plan', async () => {
  const { state } = fixture()
  const calls = []
  const api = cleanupAPI(tokens, async (url, options) => {
    calls.push(options.method)
    const u = new URL(url)
    if (u.pathname === `/repos/${scope.repository}`) return json(state.repo)
    if (u.pathname.includes('/projects/')) return json(state.project)
    if (u.pathname.endsWith('/pulls/91')) return json(state.pr)
    if (u.pathname.endsWith('/pulls')) return json(state.prs)
    if (u.pathname.endsWith('/commits')) return json(state.commits)
    if (u.pathname.includes('/git/ref/heads/')) return json({}, 404)
    if (u.pathname === '/v7/deployments')
      return json({
        deployments: [...state.rows.keys()].map((uid) => ({ uid })),
        pagination: { count: state.rows.size, next: null },
      })
    if (u.pathname.startsWith('/v13/deployments/'))
      return json(state.rows.get(u.pathname.split('/').at(-1)))
    throw new Error('unexpected endpoint')
  })
  assert.equal((await planCleanup(api, 91)).deployments.length, 2)
  assert.ok(calls.every((method) => method === 'GET'))
  assert.equal((await executeCleanup(api, 91)).reason, 'live-deletion-disabled')
  assert.ok(calls.every((method) => method === 'GET'))
})
for (const status of [401, 403, 429, 500])
  test(`HTTP ${status} cannot be mistaken for absence`, async () => {
    const api = cleanupAPI(tokens, async () => json({ error: 'private provider body' }, status))
    await assert.rejects(api.branch('feat/test'), /github-read-failed/)
    await assert.rejects(api.deployment('dpl_test'), /vercel-read-failed/)
  })
for (const next of ['123', 0, -1])
  test(`malformed pagination ${String(next)} fails closed`, async () => {
    const api = cleanupAPI(tokens, async () =>
      json({ deployments: [], pagination: { count: 0, next } }),
    )
    await assert.rejects(api.deployments('feat/test'), /invalid-vercel-cursor/)
  })
test('repeated cursor and incomplete GitHub pagination fail closed', async () => {
  const api = cleanupAPI(tokens, async (url) =>
    url.includes('vercel')
      ? json({ deployments: [], pagination: { count: 0, next: 123 } })
      : json(Array.from({ length: 100 }, () => ({}))),
  )
  await assert.rejects(api.deployments('feat/test'), /invalid-vercel-cursor/)
  await assert.rejects(api.pullRequests(), /github-pagination-incomplete/)
})
test('duplicate deployment inventory fails closed', async () => {
  const { api } = fixture()
  api.deployments = async () => [{ uid: 'dpl_old' }, { uid: 'dpl_old' }]
  assert.equal((await planCleanup(api, 91)).reason, 'duplicate-deployment-inventory')
})
test('exclusive local lock rejects concurrent work and releases after failure', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'lunia-cleanup-'))
  const path = join(dir, 'lock')
  try {
    await assert.rejects(
      withCleanupLock(path, async () => {
        await assert.rejects(withCleanupLock(path, async () => assert.fail('concurrent work ran')))
        throw new Error('work failed')
      }),
      /work failed/,
    )
    assert.equal(existsSync(path), false)
    assert.equal(await withCleanupLock(path, async () => 'next run'), 'next run')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
test('CLI rejects apply before tokens/network even if activation variables are supplied', () => {
  const result = spawnSync(
    process.execPath,
    ['scripts/preview-cleanup.mjs', '--apply', '--pr', '91'],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        GITHUB_TOKEN: '',
        LUNIA_VERCEL_CLEANUP_TOKEN: '',
        LUNIA_PREVIEW_CLEANUP_ENABLED: 'true',
      },
    },
  )
  assert.equal(result.status, 1)
  assert.match(result.stderr, /live-deletion-disabled/)
  assert.equal(result.stdout, '')
})
function eventFixture() {
  const { state } = fixture()
  return {
    env: {
      GITHUB_REPOSITORY: scope.repository,
      GITHUB_REF: 'refs/heads/master',
      GITHUB_EVENT_NAME: 'pull_request_target',
    },
    event: { repository: state.repo, action: 'closed', number: 91, pull_request: state.pr },
  }
}
test('only default-branch lifecycle and numeric manual events are admitted', () => {
  const { env, event } = eventFixture()
  assert.equal(targetFromEvent(env, event), 91)
  env.GITHUB_EVENT_NAME = 'workflow_dispatch'
  event.inputs = { pr_number: '91' }
  assert.equal(targetFromEvent(env, event), 91)
  event.inputs.pr_number = '91; echo private'
  assert.throws(() => targetFromEvent(env, event), /invalid-pr-number/)
})
for (const [name, mutate] of [
  ['PR merge checkout', (env) => (env.GITHUB_REF = 'refs/pull/91/merge')],
  ['develop checkout', (env) => (env.GITHUB_REF = 'refs/heads/develop')],
  ['foreign repository', (env) => (env.GITHUB_REPOSITORY = 'other/studio-lunia')],
  ['reopened event', (_, event) => (event.action = 'reopened')],
  ['fork event', (_, event) => event.pull_request.head.repo.id++],
])
  test(`refuses ${name} before management access`, () => {
    const { env, event } = eventFixture()
    mutate(env, event)
    assert.throws(() => targetFromEvent(env, event))
  })
test('workflow stays opt-in, read-only, serialized and never executes PR code', () => {
  const workflow = readFileSync('.github/workflows/preview-cleanup.yml', 'utf8')
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#'))
    .join('\n')
  assert.match(workflow, /pull_request_target:\n\s+types: \[closed\]/)
  assert.match(workflow, /LUNIA_PREVIEW_CLEANUP_PLANNING_ENABLED == 'true'/)
  assert.match(workflow, /github.ref == 'refs\/heads\/master'/)
  assert.match(workflow, /head.repo.full_name == 'AxelOord\/studio-lunia'/)
  assert.match(workflow, /group: studio-lunia-preview-cleanup\n\s+cancel-in-progress: false/)
  assert.match(workflow, /environment: preview-cleanup/)
  assert.match(workflow, /ref: \$\{\{ github.sha \}\}/)
  assert.match(workflow, /persist-credentials: false/)
  assert.doesNotMatch(
    workflow,
    /: write|npm (ci|install)|pull_request.head.sha|download-artifact|actions\/cache|--apply/,
  )
  assert.equal((workflow.match(/run:/g) ?? []).length, 1)
  assert.match(workflow, /run: node scripts\/preview-cleanup.mjs/)
})

test('manual fork selection makes no Vercel request', async () => {
  const { state, api } = fixture()
  state.pr.head.repo.id++
  api.project = async () => assert.fail('fork caused provider access')
  assert.equal((await planCleanup(api, 91)).reason, 'fork-or-missing-repository')
})
test('reopen before the first deletion leaves every deployment intact', async () => {
  const { state, api } = fixture()
  const read = api.repository
  let reads = 0
  api.repository = async () => {
    if (++reads === 2) state.pr.state = 'open'
    return read()
  }
  assert.equal((await executeCleanup(api, 91)).reason, 'pr-not-closed')
  assert.deepEqual(state.deleted, [])
  assert.equal(state.rows.size, 2)
})
test('valid explicit PR metadata is accepted; malformed detail is not', async () => {
  const { state, api } = fixture()
  state.rows.get('dpl_last').meta.githubPrId = '91'
  assert.equal((await planCleanup(api, 91)).status, 'planned')
  state.rows.get('dpl_last').id = 'dpl_different'
  assert.equal((await planCleanup(api, 91)).reason, 'deployment-id-mismatch')
})
test('HTTP timeout and invalid JSON are sanitized, without retry', async () => {
  for (const failure of [
    () => {
      throw new Error('secret timeout')
    },
    () => new Response('secret non-JSON'),
  ]) {
    let calls = 0
    const api = cleanupAPI(tokens, async () => {
      calls++
      return failure()
    })
    const result = await planCleanup(api, 91)
    assert.equal(result.reason, 'provider-operation-failed')
    assert.equal(JSON.stringify(result).includes('secret'), false)
    assert.equal(calls, 1)
  }
})

for (const pagination of [{ count: 1 }, { count: 1, next: null }])
  test('accepts a counted terminal Vercel page with omitted or null next cursor', async () => {
    const api = cleanupAPI(tokens, async () =>
      json({ deployments: [{ uid: 'dpl_last' }], pagination }),
    )
    assert.deepEqual(await api.deployments('feat/test'), [{ uid: 'dpl_last' }])
  })
for (const pagination of [{}, { count: 2, next: null }])
  test('refuses absent or inconsistent page counts', async () => {
    const api = cleanupAPI(tokens, async () => json({ deployments: [], pagination }))
    await assert.rejects(api.deployments('feat/test'), /invalid-vercel-page/)
  })
