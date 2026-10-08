import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fixture, head } from './fixtures/preview-cleanup.mjs'
import { scope, planCleanup, executeCleanup } from '../scripts/preview-cleanup-core.mjs'
import { policy } from '../scripts/preview-cleanup-approval.mjs'
import { cleanupAPI } from '../scripts/preview-cleanup-api.mjs'
import {
  emptyOwnership,
  validateOwnership,
  appendOwnership,
} from '../scripts/preview-ownership.mjs'
import {
  captureOwnership,
  registerOwnership,
  requireRegistrationApproval,
  writeOwnershipCandidate,
  registrationMain,
} from '../scripts/preview-register.mjs'

const env = {
  GITHUB_ACTIONS: 'true',
  GITHUB_REPOSITORY: scope.repository,
  GITHUB_REF: 'refs/heads/master',
  GITHUB_SHA: head,
  LUNIA_PREVIEW_REGISTRATION_APPROVED_SHA: head,
  GITHUB_TOKEN: 'synthetic-github',
  LUNIA_VERCEL_CLEANUP_TOKEN: 'synthetic-vercel',
}
const config = { ...policy, ownershipConsumptionEnabled: true, ownershipRegistrationEnabled: true }
function ownedFixture() {
  const { api, state } = fixture()
  state.project.name = 'studio-lunia'
  for (const row of state.rows.values()) {
    row.team = { id: scope.teamId, slug: 'axeloords-projects' }
    row.creator = { username: 'synthetic-author' }
  }
  state.alias = {
    uid: 'alias_branch',
    alias: 'studio-lunia-git-feat-owned-preview-axeloords-projects.vercel.app',
    projectId: scope.projectId,
    deploymentId: 'dpl_last',
    redirect: null,
    createdAt: Date.parse('2026-01-02T00:00:00Z'),
    updatedAt: Date.parse('2026-01-02T00:00:00Z'),
  }
  state.domains = [{ name: 'studio-lunia.vercel.app', projectId: scope.projectId }]
  state.manifest = emptyOwnership()
  const aliases = async (id) =>
    state.rows.has(id) && state.alias?.deploymentId === id
      ? [{ uid: state.alias.uid, alias: state.alias.alias, redirect: state.alias.redirect }]
      : []
  api.aliases = aliases
  api.alias = async () => structuredClone(state.alias)
  api.projectDomains = async () => structuredClone(state.domains)
  api.ownershipManifest = async () => structuredClone(state.manifest)
  const intent = {
    scope: { ...scope },
    disposable: 'exclusive-pr-preview',
    prNumber: 91,
    branch: state.pr.head.ref,
    prHead: head,
    deploymentId: 'dpl_last',
    commit: head,
    aliases: [{ id: state.alias.uid, hostname: state.alias.alias }],
  }
  return { api, state, intent }
}
async function adoptedFixture() {
  const owned = ownedFixture()
  owned.state.manifest = await registerOwnership(
    owned.api,
    emptyOwnership(),
    { kind: 'reviewed-adoption', deploymentId: 'dpl_last' },
    env,
    config,
    { intents: [owned.intent] },
  )
  return owned
}

test('reviewed exact adoption enables ordinary aliased preview cleanup without alias DELETE', async () => {
  const { state, api } = await adoptedFixture()
  const plan = await planCleanup(api, 91)
  assert.equal(plan.status, 'planned')
  assert.equal(plan.deployments[1].aliases[0].id, 'alias_branch')
  const result = await executeCleanup(api, 91)
  assert.equal(result.status, 'deployments-absent')
  assert.deepEqual(state.deleted, ['dpl_old', 'dpl_last'])
})
test('capture is a read-only proposal and does not authorize cleanup', async () => {
  const { api, state, intent } = ownedFixture()
  const record = await captureOwnership(api, intent, head)
  assert.equal(record.aliases[0].id, 'alias_branch')
  assert.equal((await planCleanup(api, 91)).reason, 'deployment-has-retained-aliases')
  assert.deepEqual(state.deleted, [])
  assert.deepEqual(state.manifest.records, [])
})
test('trusted provisioning registers an explicit completed binding while the PR is open', async () => {
  const { api, state, intent } = ownedFixture()
  state.pr.state = 'open'
  state.pr.closed_at = null
  state.branch = { object: { sha: head } }
  await assert.rejects(
    registerOwnership(api, emptyOwnership(), { kind: 'trusted-provisioning', intent }, env, config),
    /trusted-provisioning-not-enabled/,
  )
  state.manifest = await registerOwnership(
    api,
    emptyOwnership(),
    { kind: 'trusted-provisioning', intent },
    env,
    {
      ...config,
      trustedProvisioningClaimsEnabled: true,
      ownershipProvisioningAfter: '2026-01-01T00:00:00Z',
    },
  )
  assert.equal((await planCleanup(api, 91)).reason, 'pr-not-closed')
  state.pr.state = 'closed'
  state.pr.closed_at = '2026-01-03T00:00:00Z'
  state.branch = null
  assert.equal((await executeCleanup(api, 91)).status, 'deployments-absent')
})
test('trusted completion cannot backfill previews before the approved provisioning cutoff', async () => {
  const { api, intent, state } = ownedFixture()
  for (const cutoff of [null, 'invalid', '2026-01-03T00:00:00Z'])
    await assert.rejects(
      registerOwnership(api, emptyOwnership(), { kind: 'trusted-provisioning', intent }, env, {
        ...config,
        trustedProvisioningClaimsEnabled: true,
        ownershipProvisioningAfter: cutoff,
      }),
      /provisioning-record-predates-policy/,
    )
  assert.deepEqual(state.manifest.records, [])
  assert.deepEqual(state.deleted, [])
})
test('registration is disabled before provider reads and rejects unreviewed adoptions', async () => {
  const noCalls = new Proxy({}, { get: () => assert.fail('provider access') })
  await assert.rejects(
    registerOwnership(noCalls, emptyOwnership(), {}, env),
    /ownership-registration-disabled/,
  )
  await assert.rejects(
    registerOwnership(
      noCalls,
      emptyOwnership(),
      { kind: 'reviewed-adoption', deploymentId: 'dpl_last' },
      env,
      config,
      { intents: [] },
    ),
    /adoption-not-reviewed/,
  )
  for (const changed of [
    { GITHUB_REF: 'refs/heads/feature' },
    { GITHUB_REPOSITORY: 'fork/repo' },
    { GITHUB_ACTIONS: 'false' },
    { LUNIA_PREVIEW_REGISTRATION_APPROVED_SHA: 'b'.repeat(40) },
  ])
    assert.throws(
      () => requireRegistrationApproval({ ...env, ...changed }, config),
      /registration-approval-missing/,
    )
  await assert.rejects(
    registrationMain(['--adopt', 'dpl_last'], env, () => assert.fail('fetch')),
    /ownership-registration-disabled/,
  )
})
for (const [label, mutate, reason] of [
  [
    'reassigned alias',
    (s) => {
      s.alias.deploymentId = 'dpl_foreign'
    },
    'alias-routing-protected-or-changed',
  ],
  [
    'foreign project',
    (s) => {
      s.alias.projectId = 'prj_other'
    },
    'alias-routing-protected-or-changed',
  ],
  [
    'renamed hostname',
    (s) => {
      s.alias.alias = 'different.vercel.app'
    },
    'alias-not-registered',
  ],
  [
    'recreated UID',
    (s) => {
      s.alias.uid = 'new_uid'
    },
    'alias-not-registered',
  ],
  [
    'redirect',
    (s) => {
      s.alias.redirect = 'retained.example.test'
    },
    'alias-routing-protected-or-changed',
  ],
  [
    'redirect status',
    (s) => {
      s.alias.redirectStatusCode = 308
    },
    'alias-routing-protected-or-changed',
  ],
  [
    'microfrontend alias',
    (s) => {
      s.alias.microfrontends = {}
    },
    'alias-routing-protected-or-changed',
  ],
  [
    'shared bypass',
    (s) => {
      s.alias.protectionBypass = { shared: {} }
    },
    'alias-routing-protected-or-changed',
  ],
  [
    'project microfrontends',
    (s) => {
      s.project.microfrontends = {}
    },
    'microfrontend-preview-protected',
  ],
  [
    'configured project domain',
    (s) => {
      s.domains.push({ name: s.alias.alias, projectId: scope.projectId })
    },
    'alias-is-project-domain',
  ],
  [
    'malformed project domain',
    (s) => {
      s.domains = [{ name: '.', projectId: scope.projectId }]
    },
    'invalid-project-domain-inventory',
  ],
  [
    'wildcard project domain',
    (s) => {
      s.domains.push({ name: '*.vercel.app', projectId: scope.projectId })
    },
    'alias-is-project-domain',
  ],
  [
    'custom suffix',
    (s) => {
      s.alias.alias = 'preview.example.test'
    },
    'alias-not-registered',
  ],
  [
    'creation generation changed',
    (s) => {
      s.alias.createdAt++
    },
    'alias-generation-changed',
  ],
  [
    'assignment updated',
    (s) => {
      s.alias.updatedAt++
    },
    'alias-generation-changed',
  ],
  [
    'project target',
    (s) => {
      s.project.targets.production = { id: 'dpl_last' }
    },
    'deployment-is-project-target',
  ],
  [
    'user-supplied alias',
    (s) => {
      s.rows.get('dpl_last').userAliases = [s.alias.alias]
    },
    'alias-is-user-supplied',
  ],
  [
    'malformed user aliases',
    (s) => {
      s.rows.get('dpl_last').userAliases = {}
    },
    'user-alias-inventory-unverified',
  ],
])
  test(`registered aliases still retain ${label}`, async () => {
    const { api, state } = await adoptedFixture()
    // Keep list membership for the reassignment test: a stale listing must not authorize deletion.
    const listed = await api.aliases('dpl_last')
    mutate(state)
    if (label === 'reassigned alias') api.aliases = async (id) => (id === 'dpl_last' ? listed : [])
    const result = await executeCleanup(api, 91)
    assert.equal(result.reason, reason)
    assert.deepEqual(state.deleted, [])
  })
test('an additional unregistered alias blocks the whole deployment inventory', async () => {
  const { api, state } = await adoptedFixture()
  const list = api.aliases
  api.aliases = async (id) => [...(await list(id)), { uid: 'retained', alias: 'shared.vercel.app' }]
  assert.equal((await executeCleanup(api, 91)).status, 'incomplete')
  assert.deepEqual(state.deleted, [])
})
test('reassignment after partial progress stops before the aliased last deployment', async () => {
  const { api, state } = await adoptedFixture()
  const remove = api.deleteDeployment
  api.deleteDeployment = async (id) => {
    const result = await remove(id)
    state.alias.updatedAt++
    return result
  }
  const result = await executeCleanup(api, 91)
  assert.equal(result.reason, 'alias-generation-changed')
  assert.equal(result.journal.length, 1)
  assert.deepEqual(state.deleted, ['dpl_old'])
})
test('registration rejects stale claims, in-flight deployments, missing refs and provider-read races', async () => {
  for (const change of [
    ({ intent }) => {
      intent.branch = 'feat/different'
    },
    ({ intent }) => {
      intent.aliases[0].hostname = 'invented.vercel.app'
    },
    ({ state }) => {
      state.rows.get('dpl_last').readyState = 'BUILDING'
    },
    ({ state }) => {
      state.pr.state = 'open'
      state.pr.closed_at = null
    },
    ({ api, state }) => {
      api.projectDomains = async () => {
        state.pr.head.sha = 'c'.repeat(40)
        return []
      }
    },
  ]) {
    const owned = ownedFixture()
    change(owned)
    await assert.rejects(captureOwnership(owned.api, owned.intent, head))
    assert.deepEqual(owned.state.deleted, [])
  }
})
test('manifest rejects schema drift, protected refs, wrong scope and conflicting alias owners', async () => {
  const { state } = await adoptedFixture()
  for (const mutate of [
    (m) => {
      m.schemaVersion++
    },
    (m) => {
      m.scope.repositoryId++
    },
    (m) => {
      m.records[0].pr.branch = 'hosted-cms-preview'
    },
    (m) => {
      m.records[0].disposable = 'all-previews'
    },
    (m) => {
      m.records[0].aliases[0].hostname = '*.vercel.app'
    },
    (m) => {
      m.records.push(m.records[0])
    },
    (m) => {
      m.records[0].aliases.push(m.records[0].aliases[0])
    },
    (m) => {
      m.records[0].unrecognized = true
    },
  ]) {
    const manifest = structuredClone(state.manifest)
    mutate(manifest)
    assert.throws(() => validateOwnership(manifest))
  }
  for (const change of [
    { pr: { ...state.manifest.records[0].pr, number: 92 } },
    { aliases: [{ ...state.manifest.records[0].aliases[0], id: 'recreated' }] },
  ]) {
    const record = {
      ...structuredClone(state.manifest.records[0]),
      ...change,
      deployment: { ...state.manifest.records[0].deployment, id: 'dpl_another' },
    }
    assert.throws(
      () => appendOwnership(state.manifest, record),
      /ownership-alias-shared-or-recreated/,
    )
  }
})
test('repeat registration is idempotent and cannot mutate an existing deployment record', async () => {
  const { api, state, intent } = await adoptedFixture()
  const repeat = await registerOwnership(
    api,
    state.manifest,
    { kind: 'reviewed-adoption', deploymentId: 'dpl_last' },
    env,
    config,
    { intents: [intent] },
  )
  assert.deepEqual(repeat, state.manifest)
  state.alias.updatedAt++
  await assert.rejects(
    registerOwnership(
      api,
      state.manifest,
      { kind: 'reviewed-adoption', deploymentId: 'dpl_last' },
      env,
      config,
      { intents: [intent] },
    ),
    /ownership-record-immutable/,
  )
})
test('atomic candidate writes preserve concurrent updates and reject lock contention', async () => {
  const { state } = await adoptedFixture()
  const directory = mkdtempSync(join(tmpdir(), 'lunia-ownership-'))
  const path = join(directory, 'manifest.json')
  const original = `${JSON.stringify(emptyOwnership(), null, 2)}\n`
  try {
    writeFileSync(path, original)
    const results = await Promise.allSettled([
      writeOwnershipCandidate(path, original, state.manifest),
      writeOwnershipCandidate(path, original, state.manifest),
    ])
    assert.equal(results.filter((item) => item.status === 'fulfilled').length, 1)
    assert.deepEqual(JSON.parse(readFileSync(path, 'utf8')), state.manifest)
    await assert.rejects(
      writeOwnershipCandidate(path, original, emptyOwnership()),
      /ownership-snapshot-changed/,
    )
    assert.equal(
      await writeOwnershipCandidate(path, readFileSync(path, 'utf8'), state.manifest),
      'unchanged',
    )
    writeFileSync(`${path}.lock`, 'busy')
    await assert.rejects(
      writeOwnershipCandidate(path, readFileSync(path, 'utf8'), state.manifest),
      /already running/,
    )
    assert.deepEqual(JSON.parse(readFileSync(path, 'utf8')), state.manifest)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
test('saved native identity supports delayed cleanup and still detects a rename on later runs', async () => {
  const { state, api, intent } = ownedFixture()
  let native = {
    id: 'br-owned',
    projectId: 'owned-project',
    name: `preview/${intent.branch}`,
    parentId: 'br-parent',
  }
  api.nativeBranch = async () => (native?.name === `preview/${intent.branch}` ? native : null)
  api.nativeBranchById = async (id, project = 'owned-project') => {
    assert.equal(project, 'owned-project')
    return native?.id === id ? { id, projectId: project } : null
  }
  state.manifest = await registerOwnership(
    api,
    emptyOwnership(),
    { kind: 'reviewed-adoption', deploymentId: 'dpl_last' },
    env,
    config,
    { intents: [intent] },
  )
  assert.equal((await executeCleanup(api, 91)).status, 'native-cleanup-pending')
  native = { ...native, name: 'retained/renamed' }
  assert.equal((await executeCleanup(api, 91)).status, 'native-cleanup-pending')
  native = null
  assert.equal((await executeCleanup(api, 91)).status, 'cleanup-verified')
  assert.deepEqual(state.deleted, ['dpl_old', 'dpl_last'])
})

const json = (data, status = 200) => new Response(JSON.stringify(data), { status })
test('real HTTP adapters compose reviewed registration, aliased deletion and delayed native proof', async () => {
  const { state, intent } = ownedFixture()
  const liveConfig = {
    ...config,
    executionEnabled: true,
    closedAfter: '2026-01-01T00:00:00Z',
    neonProjectId: 'owned-project',
    neonOrganizationId: 'org-owned',
    neonParentBranchId: 'br-parent',
    exclusiveNativeProjectConfirmed: true,
  }
  const liveEnv = {
    ...env,
    LUNIA_PREVIEW_CLEANUP_APPROVED_SHA: head,
    LUNIA_NEON_CLEANUP_READ_TOKEN: 'synthetic-neon',
  }
  let native = {
    id: 'br-owned',
    project_id: 'owned-project',
    name: `preview/${intent.branch}`,
    parent_id: 'br-parent',
    default: false,
    protected: false,
  }
  const writes = []
  const fetcher = async (url, options) => {
    const u = new URL(url)
    if (options.method === 'DELETE') {
      assert.equal(u.hostname, 'api.vercel.com')
      assert.equal(u.search, `?teamId=${scope.teamId}`)
      const id = u.pathname.split('/').at(-1)
      assert.equal(u.pathname, `/v13/deployments/${id}`)
      writes.push(id)
      state.rows.delete(id)
      return json({ uid: id, state: 'DELETED' })
    }
    assert.equal(options.method, 'GET')
    if (u.hostname === 'console.neon.tech') {
      if (u.pathname.endsWith('/branches'))
        return json({ branches: native ? [native] : [], pagination: {} })
      if (u.pathname.endsWith('/branches/br-owned'))
        return native ? json({ branch: native }) : json({}, 404)
      return json({ project: { id: 'owned-project', org_id: 'org-owned' } })
    }
    if (u.pathname === `/repos/${scope.repository}`) return json(state.repo)
    if (u.pathname.endsWith('/pulls/91')) return json(state.pr)
    if (u.pathname.endsWith('/pulls')) return json(state.prs)
    if (u.pathname.endsWith('/commits')) return json(state.commits)
    if (u.pathname.includes('/git/ref/heads/')) return json({}, 404)
    if (u.pathname.endsWith('/domains'))
      return json({ domains: state.domains, pagination: { count: state.domains.length } })
    if (u.pathname === `/v9/projects/${scope.projectId}`) return json(state.project)
    if (u.pathname === '/v4/aliases/alias_branch') return json(state.alias)
    if (u.pathname.endsWith('/aliases'))
      return json({
        aliases: u.pathname.includes('dpl_last')
          ? [{ uid: state.alias.uid, alias: state.alias.alias }]
          : [],
      })
    if (u.pathname === '/v7/deployments')
      return json({
        deployments: [...state.rows.keys()].map((uid) => ({ uid })),
        pagination: { count: state.rows.size },
      })
    if (u.pathname.startsWith('/v13/deployments/')) {
      const row = state.rows.get(u.pathname.split('/').at(-1))
      return row ? json(row) : json({}, 404)
    }
    assert.fail(`unexpected fake endpoint ${u.pathname}`)
  }
  const registrationApi = cleanupAPI(liveEnv, fetcher, { policy: liveConfig })
  const committed = readFileSync('scripts/preview-ownership-manifest.json', 'utf8')
  const candidate = await registrationMain(
    ['--adopt', intent.deploymentId],
    liveEnv,
    fetcher,
    liveConfig,
    { intents: [intent] },
  )
  try {
    assert.equal(candidate.status, 'candidate-written')
    assert.equal(candidate.published, false)
    assert.equal(JSON.parse(readFileSync(candidate.candidatePath, 'utf8')).records.length, 1)
    assert.equal(readFileSync('scripts/preview-ownership-manifest.json', 'utf8'), committed)
    // Even a new cleanup API in the same job must not consume the unpublished candidate.
    assert.deepEqual(
      cleanupAPI(liveEnv, fetcher, { policy: liveConfig }).ownershipManifest(),
      emptyOwnership(),
    )
  } finally {
    rmSync(dirname(candidate.candidatePath), { recursive: true, force: true })
  }
  const manifest = await registerOwnership(
    registrationApi,
    emptyOwnership(),
    { kind: 'reviewed-adoption', deploymentId: intent.deploymentId },
    liveEnv,
    liveConfig,
    { intents: [intent] },
  )
  assert.deepEqual(writes, [])
  await assert.rejects(registrationApi.deleteDeployment('dpl_last'), /live-deletion-disabled/)
  const api = cleanupAPI(liveEnv, fetcher, { apply: true, policy: liveConfig, manifest })
  assert.equal((await executeCleanup(api, 91)).status, 'native-cleanup-pending')
  native = { ...native, name: 'renamed/keep' }
  assert.equal((await executeCleanup(api, 91)).nativeDatabase, 'retained')
  native = null
  const later = await executeCleanup(api, 91)
  assert.equal(later.status, 'cleanup-verified')
  assert.equal(later.nativeBranchId, 'br-owned')
  assert.deepEqual(writes, ['dpl_old', 'dpl_last'])
})
test('configured project/author URLs cannot be adopted even with an explicit claim', async () => {
  for (const hostname of [
    'studio-lunia.vercel.app',
    'studio-lunia-axeloords-projects.vercel.app',
    'studio-lunia-synthetic-author-axeloords-projects.vercel.app',
  ]) {
    const { api, state, intent } = ownedFixture()
    state.alias.alias = hostname
    intent.aliases[0].hostname = hostname
    state.domains = []
    await assert.rejects(
      captureOwnership(api, intent, head),
      /alias-is-shared-project-or-author-url/,
    )
  }
})
test('explicitly disabled microfrontends with no groups does not reject an ordinary preview', async () => {
  const { api, state, intent } = ownedFixture()
  state.project.microfrontends = { enabled: false, groupIds: [], updatedAt: 1 }
  assert.equal((await captureOwnership(api, intent, head)).aliases.length, 1)
  state.project.microfrontends.groupIds.push('shared')
  await assert.rejects(captureOwnership(api, intent, head), /microfrontend-preview-protected/)
})
test('successive explicit bindings are allowed only for the same PR, ref and alias generation', async () => {
  const { state } = await adoptedFixture()
  const original = state.manifest.records[0]
  const next = {
    ...structuredClone(original),
    deployment: { ...original.deployment, id: 'dpl_next' },
  }
  assert.equal(appendOwnership(state.manifest, next).records.length, 2)
  for (const branch of ['feat-owned-preview', 'feat/owned-preview-truncated-suffix']) {
    const collision = { ...next, pr: { ...next.pr, branch } }
    assert.throws(
      () => appendOwnership(state.manifest, collision),
      /ownership-alias-shared-or-recreated/,
    )
  }
})
test('read adapters pin alias/project scope and completely paginate configured domains', async () => {
  const calls = []
  const api = cleanupAPI(env, async (url, options) => {
    const u = new URL(url)
    calls.push(u)
    assert.equal(options.method, 'GET')
    assert.equal(options.redirect, 'error')
    assert.equal(u.searchParams.get('teamId'), scope.teamId)
    if (u.pathname === '/v4/aliases/alias_exact') {
      assert.equal(u.searchParams.get('projectId'), scope.projectId)
      return json({ uid: 'alias_exact' })
    }
    assert.equal(u.pathname, `/v9/projects/${scope.projectId}/domains`)
    assert.equal(u.searchParams.has('production'), false)
    assert.equal(u.searchParams.has('gitBranch'), false)
    return u.searchParams.has('until')
      ? json({
          domains: [{ name: 'custom.example.test', projectId: scope.projectId }],
          pagination: { count: 1 },
        })
      : json({ domains: [], pagination: { count: 0, next: 100 } })
  })
  assert.equal((await api.alias('alias_exact')).uid, 'alias_exact')
  assert.equal((await api.projectDomains()).length, 1)
  assert.equal(calls.length, 3)
})
for (const [label, response] of [
  ['missing pagination', { domains: [] }],
  ['wrong count', { domains: [], pagination: { count: 2 } }],
  ['repeated cursor', { domains: [], pagination: { count: 0, next: 100 } }],
])
  test(`project domains fail closed on ${label}`, async () => {
    const api = cleanupAPI(env, async () => json(response))
    await assert.rejects(api.projectDomains())
  })
test('committed gates and empty data cannot register or consume injected runtime authority', async () => {
  const { state } = await adoptedFixture()
  const disabled = cleanupAPI(env, () => assert.fail('fetch'), { manifest: state.manifest })
  assert.deepEqual(disabled.ownershipManifest(), emptyOwnership())
  assert.deepEqual(
    JSON.parse(readFileSync('scripts/preview-ownership-manifest.json', 'utf8')).records,
    [],
  )
  assert.deepEqual(
    JSON.parse(readFileSync('scripts/preview-ownership-adoptions.json', 'utf8')).intents,
    [],
  )
  const result = spawnSync(
    process.execPath,
    ['scripts/preview-register.mjs', '--adopt', 'dpl_last'],
    { encoding: 'utf8', env: { PATH: process.env.PATH } },
  )
  assert.equal(result.status, 1)
  assert.match(result.stderr, /ownership-registration-disabled/)
})
