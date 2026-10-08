import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { crc32, deflateRawSync } from 'node:zlib'
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import artifactFixtures from './fixtures/ownership-artifacts.json' with { type: 'json' }
import { fixture, head } from './fixtures/preview-cleanup.mjs'
import { scope } from '../scripts/preview-cleanup-identity.mjs'
import { policy } from '../scripts/preview-cleanup-approval.mjs'
import { emptyOwnership } from '../scripts/preview-ownership.mjs'
import { cleanupAPI } from '../scripts/preview-cleanup-api.mjs'
import { executeCleanup } from '../scripts/preview-cleanup-core.mjs'
import { withCleanupLock, cleanupLockPath } from '../scripts/preview-cleanup.mjs'
import { intakeEvent, collectOwnership, intakeMain } from '../scripts/preview-intake.mjs'
import { loadReceipts, makeReceipt, receiptLifetime } from '../scripts/preview-receipts.mjs'
import { receiptsAPI, receiptFromZip, receiptWorkflow } from '../scripts/preview-receipts-api.mjs'

const now = Date.now()
const env = {
  GITHUB_ACTIONS: 'true',
  GITHUB_REPOSITORY: scope.repository,
  GITHUB_REF: 'refs/heads/master',
  GITHUB_SHA: head,
  GITHUB_EVENT_NAME: 'repository_dispatch',
  GITHUB_ACTOR_ID: '123',
  GITHUB_RUN_ID: '10',
  GITHUB_RUN_ATTEMPT: '1',
  LUNIA_PREVIEW_REGISTRATION_APPROVED_SHA: head,
  LUNIA_PREVIEW_RECEIPT_APPROVED_SHAS: head,
  GITHUB_TOKEN: 'synthetic-github',
  LUNIA_VERCEL_REGISTRATION_READ_TOKEN: 'synthetic-vercel',
  LUNIA_VERCEL_CLEANUP_TOKEN: 'synthetic-vercel',
  LUNIA_NEON_CLEANUP_READ_TOKEN: 'synthetic-neon',
}
const config = {
  ...policy,
  ownershipRegistrationEnabled: true,
  ownershipConsumptionEnabled: true,
  ownershipReceiptsEnabled: true,
  trustedProvisioningClaimsEnabled: true,
  prospectiveNativeAliasesExclusive: true,
  vercelDispatchSenderId: 123,
  ownershipProvisioningAfter: '2026-01-01T00:00:00Z',
  neonProjectId: 'test-project',
  neonOrganizationId: 'org-test',
  neonParentBranchId: 'br-main',
}

function owned() {
  const { api, state } = fixture()
  state.project.name = 'studio-lunia'
  for (const row of state.rows.values()) {
    row.team = { id: scope.teamId, slug: 'axeloords-projects' }
    row.creator = { username: 'synthetic-author' }
  }
  state.alias = {
    uid: 'alias_owned',
    alias: 'studio-lunia-git-feat-owned-preview-axeloords-projects.vercel.app',
    projectId: scope.projectId,
    deploymentId: 'dpl_last',
    createdAt: now - 100000,
    updatedAt: now - 50000,
  }
  state.native = {
    id: 'br-preview',
    projectId: 'test-project',
    name: `preview/${state.pr.head.ref}`,
    parentId: 'br-main',
  }
  api.aliases = async (id) =>
    state.rows.has(id) && state.alias?.deploymentId === id
      ? [{ uid: state.alias.uid, alias: state.alias.alias }]
      : []
  api.alias = async () => structuredClone(state.alias)
  api.projectDomains = async () => []
  api.nativeBranch = async () => structuredClone(state.native)
  api.nativeBranchById = async () =>
    state.native ? { id: state.native.id, projectId: 'test-project' } : null
  const event = {
    repository: state.repo,
    action: 'vercel.deployment.success',
    sender: { id: 123, type: 'Bot' },
    client_payload: {
      id: 'dpl_last',
      environment: 'preview',
      project: { id: scope.projectId },
      git: { ref: state.pr.head.ref, sha: head },
      url: 'https://untrusted.invalid/never-fetch-this',
    },
  }
  return { api, state, event }
}
function archive(value, method = 0, descriptor = false) {
  const data = Buffer.from(JSON.stringify(value))
  const compressed = method === 8 ? deflateRawSync(data) : data
  const name = Buffer.from('ownership.json')
  const local = Buffer.alloc(30)
  local.writeUInt32LE(0x04034b50)
  local.writeUInt16LE(20, 4)
  local.writeUInt16LE(descriptor ? 8 : 0, 6)
  local.writeUInt16LE(method, 8)
  if (!descriptor) {
    local.writeUInt32LE(crc32(data), 14)
    local.writeUInt32LE(compressed.length, 18)
    local.writeUInt32LE(data.length, 22)
  }
  local.writeUInt16LE(name.length, 26)
  const suffix = Buffer.alloc(descriptor ? 16 : 0)
  if (descriptor) {
    suffix.writeUInt32LE(0x08074b50)
    suffix.writeUInt32LE(crc32(data), 4)
    suffix.writeUInt32LE(compressed.length, 8)
    suffix.writeUInt32LE(data.length, 12)
  }
  const central = Buffer.alloc(46)
  central.writeUInt32LE(0x02014b50)
  central.writeUInt16LE(20, 6)
  central.writeUInt16LE(descriptor ? 8 : 0, 8)
  central.writeUInt16LE(method, 10)
  central.writeUInt32LE(crc32(data), 16)
  central.writeUInt32LE(compressed.length, 20)
  central.writeUInt32LE(data.length, 24)
  central.writeUInt16LE(name.length, 28)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50)
  end.writeUInt16LE(1, 8)
  end.writeUInt16LE(1, 10)
  end.writeUInt32LE(central.length + name.length, 12)
  end.writeUInt32LE(local.length + name.length + compressed.length + suffix.length, 16)
  return Buffer.concat([local, name, compressed, suffix, central, name, end])
}
const digest = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`
async function receiptFixture() {
  const item = owned()
  const captured = await collectOwnership(
    item.api,
    emptyOwnership(),
    env,
    config,
    { intents: [] },
    intakeEvent(env, item.event, config),
  )
  assert.equal(captured.manifest.records.length, 1)
  const receipt = makeReceipt(captured.manifest, env, now)
  const artifact = {
    id: 20,
    name: 'preview-ownership-10-1',
    expired: false,
    created_at: new Date(now).toISOString(),
    expires_at: new Date(now + 14 * 86400000).toISOString(),
    workflow_run: {
      id: 10,
      repository_id: scope.repositoryId,
      head_repository_id: scope.repositoryId,
      head_branch: 'master',
      head_sha: head,
    },
  }
  const run = {
    id: 10,
    workflow_id: 30,
    path: receiptWorkflow,
    head_branch: 'master',
    head_sha: head,
    repository: item.state.repo,
    head_repository: item.state.repo,
    run_attempt: 1,
    status: 'completed',
    conclusion: 'success',
    event: 'repository_dispatch',
    actor: { id: 123, type: 'Bot' },
    created_at: new Date(now - 10000).toISOString(),
    updated_at: new Date(now + 10000).toISOString(),
  }
  const actions = {
    workflow: async () => ({ id: 30, path: receiptWorkflow, state: 'active' }),
    artifacts: async () => [artifact],
    run: async () => run,
    receipt: async () => structuredClone(receipt),
  }
  return { ...item, receipt, artifact, run, actions }
}

test('completion → immutable receipt → cleanup → delayed native verification without Git publication', async () => {
  const { api, state, actions } = await receiptFixture()
  api.ownershipManifest = () => loadReceipts(actions, emptyOwnership(), env, config, now)
  assert.equal((await executeCleanup(api, 91)).status, 'native-cleanup-pending')
  assert.deepEqual(state.deleted, ['dpl_old', 'dpl_last'])
  state.native = null
  assert.equal((await executeCleanup(api, 91)).status, 'cleanup-verified')
  assert.equal(state.deleted.length, 2)
})
for (const [label, mutate] of [
  ['sender', (e) => e.sender.id++],
  ['non-bot sender', (e) => (e.sender.type = 'User')],
  ['action', (e) => (e.action = 'vercel.deployment.promoted')],
  ['repository', (e) => e.repository.id++],
  ['project', (e) => (e.client_payload.project.id = 'prj_other')],
  ['production', (e) => (e.client_payload.environment = 'production')],
  ['unsafe ID', (e) => (e.client_payload.id = '../../other')],
])
  test(`rejects ${label} completion before provider reads`, () => {
    const { event } = owned()
    mutate(event)
    assert.throws(() => intakeEvent(env, event, config))
  })
test('runtime variables cannot enable committed defaults or a PR checkout', () => {
  const { event } = owned()
  assert.throws(() => intakeEvent(env, event, policy), /disabled/)
  assert.throws(() => intakeEvent({ ...env, GITHUB_REF: 'refs/pull/91/merge' }, event, config))
  assert.throws(() => intakeEvent({ ...env, GITHUB_ACTOR_ID: '456' }, event, config))
})
test('owner prospective policy is necessary; a native event alone never supplies intent', async () => {
  const { api } = owned()
  const result = await collectOwnership(
    api,
    emptyOwnership(),
    env,
    { ...config, prospectiveNativeAliasesExclusive: false },
    { intents: [] },
  )
  assert.equal(result.manifest.records.length, 0)
})
test('older deployments require exact reviewed adoption even after future policy is enabled', async () => {
  const { api, event } = owned()
  const later = { ...config, ownershipProvisioningAfter: '2026-02-01T00:00:00Z' }
  const result = await collectOwnership(api, emptyOwnership(), env, later, { intents: [] })
  assert.equal(result.manifest.records.length, 0)
  assert.equal(result.results[0].status, 'observed')
  const intent = {
    scope: { ...scope },
    disposable: 'exclusive-pr-preview',
    prNumber: 91,
    branch: event.client_payload.git.ref,
    prHead: head,
    deploymentId: 'dpl_last',
    commit: head,
    aliases: [
      {
        id: 'alias_owned',
        hostname: 'studio-lunia-git-feat-owned-preview-axeloords-projects.vercel.app',
      },
    ],
  }
  // The complete inventory includes an earlier unadopted alias-free deployment.
  const adopted = await collectOwnership(api, emptyOwnership(), env, later, { intents: [intent] })
  assert.equal(adopted.manifest.records[0].registration.kind, 'reviewed-adoption')
})
test('scheduled reconciliation recovers missed events and duplicate delivery is idempotent', async () => {
  const { api } = owned()
  const first = await collectOwnership(api, emptyOwnership(), env, config, { intents: [] })
  assert.equal(first.manifest.records.length, 2)
  const second = await collectOwnership(api, first.manifest, env, config, { intents: [] })
  assert.deepEqual(second.manifest, first.manifest)
})
test('active deployments and later partial failure do not publish a partially captured PR', async () => {
  const { api, state } = owned()
  state.rows.get('dpl_last').readyState = 'BUILDING'
  const result = await collectOwnership(api, emptyOwnership(), env, config, { intents: [] })
  assert.equal(result.manifest.records.length, 0)
  assert.equal(result.results[0].reason, 'deployment-active')
})
test('reopen during capture prevents publication', async () => {
  const { api, state } = owned()
  api.alias = async () => {
    state.pr.state = 'open'
    state.branch = { object: { sha: head } }
    return state.alias
  }
  const result = await collectOwnership(api, emptyOwnership(), env, config, { intents: [] })
  assert.equal(result.manifest.records.length, 0)
})
test('out-of-order or changed completion does not authorize a different deployment', async () => {
  const { api, event } = owned()
  const completion = intakeEvent(env, event, config)
  await assert.rejects(
    collectOwnership(
      api,
      emptyOwnership(),
      env,
      config,
      { intents: [] },
      { ...completion, commit: 'c'.repeat(40) },
    ),
    /completion-registration-blocked/,
  )
})
test('native identity not ready blocks capture and is recovered on the next inventory', async () => {
  const { api, state } = owned()
  const native = state.native
  state.native = null
  assert.equal(
    (await collectOwnership(api, emptyOwnership(), env, config, { intents: [] })).manifest.records
      .length,
    0,
  )
  state.native = native
  assert.equal(
    (await collectOwnership(api, emptyOwnership(), env, config, { intents: [] })).manifest.records
      .length,
    2,
  )
})
test('prospective policy protects shortened or additional aliases', async () => {
  const { api, state } = owned()
  state.alias.alias = 'studio-lunia-git-short-axeloords-projects.vercel.app'
  const result = await collectOwnership(api, emptyOwnership(), env, config, { intents: [] })
  assert.equal(result.manifest.records.length, 0)
  assert.equal(result.results[0].reason, 'prospective-alias-ambiguous')
})
test('normalized branch collisions remain protected despite distinct full refs and policy approval', async () => {
  const { api, state } = owned()
  const peer = structuredClone(state.pr)
  peer.number = 92
  peer.head.ref = 'feat-owned-preview'
  state.prs.push(peer)
  const result = await collectOwnership(api, emptyOwnership(), env, config, { intents: [] })
  assert.equal(result.manifest.records.length, 0)
  assert.equal(result.results[0].reason, 'prospective-alias-ambiguous')
})
test('a normalized branch collision after receipt publication blocks cleanup before any DELETE', async () => {
  const { api, state, actions } = await receiptFixture()
  const peer = structuredClone(state.pr)
  peer.number = 92
  peer.head.ref = 'feat-owned-preview'
  state.prs.push(peer)
  api.ownershipManifest = () => loadReceipts(actions, emptyOwnership(), env, config, now)
  const result = await executeCleanup(api, 91)
  assert.equal(result.reason, 'prospective-alias-ambiguous')
  assert.deepEqual(state.deleted, [])
})
test('additional aliases require explicit adoption rather than prospective policy', async () => {
  const { api } = owned()
  const list = api.aliases
  api.aliases = async (id) => [...(await list(id)), { uid: 'extra', alias: 'extra.vercel.app' }]
  const result = await collectOwnership(api, emptyOwnership(), env, config, { intents: [] })
  assert.equal(result.manifest.records.length, 0)
  assert.equal(result.results[0].reason, 'prospective-alias-ambiguous')
})
for (const [label, mutate] of [
  ['fork artifact', (f) => f.artifact.workflow_run.head_repository_id++],
  ['PR branch', (f) => (f.artifact.workflow_run.head_branch = 'feat/untrusted')],
  ['unapproved SHA', (f) => (f.artifact.workflow_run.head_sha = 'c'.repeat(40))],
  ['other workflow', (f) => f.run.workflow_id++],
  ['other path', (f) => (f.run.path = '.github/workflows/ci.yml')],
  ['forged repository', (f) => (f.run.repository = { ...f.state.repo, id: 0 })],
  ['PR event', (f) => (f.run.event = 'pull_request')],
  ['failed publication', (f) => (f.run.conclusion = 'failure')],
  ['unfinished publication', (f) => (f.run.status = 'in_progress')],
  ['wrong dispatch actor', (f) => f.run.actor.id++],
])
  test(`${label} receipt grants no authority`, async () => {
    const f = await receiptFixture()
    mutate(f)
    f.actions.receipt = () => assert.fail('untrusted archive was downloaded')
    assert.deepEqual(
      await loadReceipts(f.actions, emptyOwnership(), env, config, now),
      emptyOwnership(),
    )
  })
for (const [label, mutate] of [
  ['replay', (r) => r.producer.runId++],
  ['attempt replay', (r) => r.producer.attempt++],
  ['wrong code', (r) => (r.producer.workflowSha = 'c'.repeat(40))],
  ['scope', (r) => (r.scope.projectId = 'prj_other')],
  ['extended lifetime', (r) => r.expiresAt++],
  [
    'future time',
    (r) => {
      r.issuedAt += 600000
      r.expiresAt += 600000
    },
  ],
  ['extra field', (r) => (r.untrusted = true)],
  ['manifest schema', (r) => r.manifest.schemaVersion++],
])
  test(`trusted receipt with ${label} fails closed`, async () => {
    const f = await receiptFixture()
    mutate(f.receipt)
    await assert.rejects(loadReceipts(f.actions, emptyOwnership(), env, config, now))
  })
test('expired receipts are not authority or renewal input; valid receipts preserve native IDs across runs', async () => {
  const f = await receiptFixture()
  const current = await loadReceipts(
    f.actions,
    emptyOwnership(),
    env,
    config,
    now + receiptLifetime - 1,
  )
  assert.equal(current.records[0].nativeBranch.id, 'br-preview')
  const renewed = makeReceipt(current, { ...env, GITHUB_RUN_ID: '11' }, now + receiptLifetime - 1)
  assert.equal(renewed.expiresAt, now + 2 * receiptLifetime - 1)
  assert.equal(
    (await loadReceipts(f.actions, emptyOwnership(), env, config, now + receiptLifetime)).records
      .length,
    0,
  )
  f.artifact.expired = true
  f.actions.receipt = () => assert.fail('expired archive downloaded')
  assert.equal(
    (await loadReceipts(f.actions, emptyOwnership(), env, config, now)).records.length,
    0,
  )
})
test('conflicting receipts cannot overwrite immutable deployment/native ownership', async () => {
  const f = await receiptFixture()
  const base = structuredClone(f.receipt.manifest)
  base.records[0].nativeBranch.id = 'br-other'
  await assert.rejects(loadReceipts(f.actions, base, env, config, now), /immutable/)
})
test('newest complete verified snapshot preserves prior data without redownloading every historical copy', async () => {
  const f = await receiptFixture()
  const older = { ...f.artifact, id: 19, created_at: new Date(now - 10000).toISOString() }
  f.actions.artifacts = async () => [older, f.artifact]
  let downloads = 0
  f.actions.receipt = async (artifact) => {
    downloads++
    assert.equal(artifact.id, 20)
    return f.receipt
  }
  assert.equal(
    (await loadReceipts(f.actions, emptyOwnership(), env, config, now)).records.length,
    1,
  )
  assert.equal(downloads, 1)
  f.receipt.scope.projectId = 'prj_other'
  await assert.rejects(loadReceipts(f.actions, emptyOwnership(), env, config, now))
  assert.equal(downloads, 2) // No fallback to the older archive after a trusted failure.
})
for (const method of [0, 8])
  for (const descriptor of [false, true])
    test(`bounded archive accepts method ${method} descriptor ${descriptor}`, () => {
      const bytes = archive({ example: 'owned synthetic data' }, method, descriptor)
      assert.deepEqual(receiptFromZip(bytes, digest(bytes)), { example: 'owned synthetic data' })
    })
for (const [label, mutate] of [
  ['two entries', (b) => b.writeUInt16LE(2, b.length - 12)],
  ['encryption', (b) => b.writeUInt16LE(1, 6)],
  ['path name', (b) => b.write('../owned.json', 30)],
  ['ZIP64', (b) => b.writeUInt32LE(0xffffffff, b.length - 6)],
  ['checksum', (b) => b.writeUInt32LE(0, 14)],
])
  test(`rejects ${label} archive without extracting or executing it`, () => {
    const bytes = archive({ data: 'example' })
    mutate(bytes)
    assert.throws(() => receiptFromZip(bytes, digest(bytes)))
  })
test('digest corruption and oversized expansion are rejected', () => {
  const bytes = archive({ data: 'example' })
  assert.throws(() => receiptFromZip(bytes, `sha256:${'0'.repeat(64)}`))
  const bomb = archive({ data: 'a'.repeat(4 * 1024 * 1024) }, 8)
  assert.throws(() => receiptFromZip(bomb, digest(bomb)))
})
test('decodes independent streamed ZIP fixtures from the Actions toolkit archive library', () => {
  for (const item of artifactFixtures.fixtures)
    assert.deepEqual(
      receiptFromZip(Buffer.from(item.zipBase64, 'base64'), item.digest),
      artifactFixtures.payload,
    )
})
test('completion for a fork is rejected before any provider read', async () => {
  const { api, state, event } = owned()
  state.pr.head.repo.id++
  api.deployment = () => assert.fail('provider read for a fork')
  await assert.rejects(
    collectOwnership(
      api,
      emptyOwnership(),
      env,
      config,
      { intents: [] },
      intakeEvent(env, event, config),
    ),
    /completion-pr-unverified/,
  )
})
test('receipt provenance addresses the exact successful attempt even after a later rerun', async () => {
  const f = await receiptFixture()
  f.actions.run = async (id, attempt) => {
    assert.equal(id, 10)
    assert.equal(attempt, 1)
    return f.run
  }
  assert.equal(
    (await loadReceipts(f.actions, emptyOwnership(), env, config, now)).records.length,
    1,
  )
})
test('renewal cannot launder an unapproved original registration SHA', async () => {
  const f = await receiptFixture()
  f.receipt.manifest.records[0].registration.workflowSha = 'c'.repeat(40)
  await assert.rejects(
    loadReceipts(f.actions, emptyOwnership(), env, config, now),
    /receipt-registration-code-unapproved/,
  )
})
test('oversized valid ownership snapshots stop before artifact publication without truncation', async () => {
  const f = await receiptFixture()
  const original = f.receipt.manifest.records[0]
  const aliases = Array.from({ length: 100 }, (_, index) => ({
    ...original.aliases[0],
    id: `alias_${index}`,
    hostname: `owned-native-alias-${index}.vercel.app`,
  }))
  const large = {
    ...emptyOwnership(),
    records: Array.from({ length: 400 }, (_, index) => ({
      ...original,
      deployment: { ...original.deployment, id: `dpl_${index}` },
      aliases,
    })),
  }
  assert.throws(() => makeReceipt(large, env, now), /receipt-publication-size-exceeded/)
  assert.equal(large.records.length, 400)
})
test('intake and cleanup cannot overlap locally or prepare a partial receipt while locked', async () => {
  const { event } = owned()
  const directory = mkdtempSync(join(tmpdir(), 'lunia-locked-intake-'))
  const eventPath = join(directory, 'event.json')
  const outputPath = join(directory, 'output')
  writeFileSync(eventPath, JSON.stringify(event))
  writeFileSync(outputPath, '')
  try {
    await withCleanupLock(cleanupLockPath, async () => {
      await assert.rejects(
        intakeMain(
          {
            ...env,
            RUNNER_TEMP: directory,
            GITHUB_OUTPUT: outputPath,
            GITHUB_EVENT_PATH: eventPath,
          },
          () => assert.fail('read before lock'),
          config,
        ),
        /already running/,
      )
      assert.equal(readFileSync(outputPath, 'utf8'), '')
    })
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
test('artifact HTTP pagination is complete and detects duplicate, changing and truncated pages', async () => {
  const rows = Array.from({ length: 101 }, (_, index) => ({ id: index + 1, name: 'other' }))
  const calls = []
  const fetcher = async (url, init) => {
    calls.push(url)
    assert.equal(init.method, 'GET')
    const page = Number(new URL(url).searchParams.get('page'))
    return Response.json({ total_count: 101, artifacts: rows.slice((page - 1) * 100, page * 100) })
  }
  assert.equal((await receiptsAPI(env, fetcher).artifacts()).length, 101)
  assert.equal(calls.length, 2)
  for (const kind of ['duplicate', 'changed', 'truncated', 'over-limit']) {
    await assert.rejects(
      receiptsAPI(env, async (url) => {
        const page = Number(new URL(url).searchParams.get('page'))
        const data = {
          total_count: kind === 'over-limit' ? 2001 : 101,
          artifacts: rows.slice((page - 1) * 100, page * 100),
        }
        if (page === 2) {
          if (kind === 'duplicate') data.artifacts = [rows[0]]
          if (kind === 'changed') data.total_count++
          if (kind === 'truncated') data.artifacts = []
        }
        return Response.json(data)
      }).artifacts(),
    )
  }
})
test('signed artifact download is bounded, digest-verified and never receives the GitHub token', async () => {
  const bytes = archive({ test: true }, 8, true)
  let calls = 0
  const fetcher = async (url, init) => {
    calls++
    if (calls === 1) {
      assert.match(
        url,
        /api.github.com\/repos\/AxelOord\/studio-lunia\/actions\/artifacts\/20\/zip$/,
      )
      assert.equal(init.headers.Authorization, 'Bearer synthetic-github')
      return new Response(null, {
        status: 302,
        headers: { location: 'https://example.blob.core.windows.net/owned?sig=synthetic' },
      })
    }
    assert.equal(init.headers, undefined)
    assert.equal(init.redirect, 'error')
    return new Response(bytes)
  }
  assert.deepEqual(
    await receiptsAPI(env, fetcher).receipt({
      id: 20,
      size_in_bytes: bytes.length,
      digest: digest(bytes),
    }),
    { test: true },
  )
})
for (const location of [
  'https://evil.example/archive',
  'http://example.blob.core.windows.net/x',
  'https://user:pass@example.blob.core.windows.net/x',
])
  test(`artifact redirect ${location} is refused`, async () => {
    let calls = 0
    await assert.rejects(
      receiptsAPI(env, async () => {
        calls++
        return new Response(null, { status: 302, headers: { location } })
      }).receipt({ id: 20, size_in_bytes: 10 }),
    )
    assert.equal(calls, 1)
  })
test('workflows publish data only from default code, share concurrency and remain opt-in', () => {
  const producer = readFileSync('.github/workflows/preview-ownership.yml', 'utf8')
  const consumer = readFileSync('.github/workflows/preview-cleanup.yml', 'utf8')
  for (const text of [producer, consumer]) {
    assert.match(text, /github.ref == 'refs\/heads\/master'/)
    assert.match(text, /group: studio-lunia-preview-cleanup\n\s+cancel-in-progress: false/)
    assert.match(text, /actions: read/)
    const executable = text
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('#'))
      .join('\n')
    assert.doesNotMatch(executable, /: write|npm (ci|install)|pull_request.head.sha|actions\/cache/)
  }
  assert.match(producer, /types: \[vercel.deployment.success\]/)
  assert.match(producer, /LUNIA_PREVIEW_OWNERSHIP_ENABLED == 'true'/)
  assert.match(producer, /overwrite: false/)
  assert.match(producer, /retention-days: 14/)
  assert.equal(policy.ownershipReceiptsEnabled, false)
  assert.equal(policy.prospectiveNativeAliasesExclusive, false)
  assert.equal(policy.vercelDispatchSenderId, null)
})

test('real intake CLI prepares only runner-owned receipt data using fake HTTP; real adapter consumes it', async () => {
  const f = owned()
  const directory = mkdtempSync(join(tmpdir(), 'lun ia-receipts-'))
  const eventPath = join(directory, 'event.json')
  const outputPath = join(directory, 'output')
  writeFileSync(eventPath, JSON.stringify(f.event))
  writeFileSync(outputPath, '')
  let published
  const receiptState = await receiptFixture()
  const fetcher = async (url, init) => {
    assert.equal(init.method, 'GET')
    const u = new URL(url)
    const path = u.pathname
    if (u.hostname.endsWith('.blob.core.windows.net')) return new Response(published)
    if (path.endsWith('/actions/workflows/preview-ownership.yml'))
      return Response.json({ id: 30, path: receiptWorkflow, state: 'active' })
    if (path.endsWith('/actions/artifacts'))
      return Response.json({
        total_count: published ? 1 : 0,
        artifacts: published
          ? [
              {
                ...receiptState.artifact,
                digest: digest(published),
                size_in_bytes: published.length,
              },
            ]
          : [],
      })
    if (path.endsWith('/actions/runs/10/attempts/1')) return Response.json(receiptState.run)
    if (path.endsWith('/actions/artifacts/20/zip'))
      return new Response(null, {
        status: 302,
        headers: { location: 'https://example.blob.core.windows.net/receipt' },
      })
    if (u.hostname === 'api.github.com') {
      if (path.endsWith('/pulls')) return Response.json(f.state.prs)
      if (path.endsWith('/pulls/91')) return Response.json(f.state.pr)
      if (path.endsWith('/commits')) return Response.json(f.state.commits)
      if (path.includes('/git/ref/')) return new Response(null, { status: 404 })
      return Response.json(f.state.repo)
    }
    if (u.hostname === 'console.neon.tech') {
      if (path.endsWith('/branches'))
        return Response.json({
          branches: [
            {
              id: 'br-preview',
              project_id: 'test-project',
              name: f.state.native.name,
              parent_id: 'br-main',
              default: false,
              protected: false,
            },
          ],
          pagination: {},
        })
      return Response.json({ project: { id: 'test-project', org_id: 'org-test' } })
    }
    assert.equal(u.hostname, 'api.vercel.com')
    if (path.endsWith('/domains')) return Response.json({ domains: [], pagination: { count: 0 } })
    if (path.includes('/projects/')) return Response.json(f.state.project)
    if (path.endsWith('/aliases'))
      return Response.json({ aliases: await f.api.aliases('dpl_last') })
    if (path.includes('/v4/aliases/')) return Response.json(f.state.alias)
    return Response.json(f.state.rows.get('dpl_last'))
  }
  try {
    const output = await intakeMain(
      { ...env, RUNNER_TEMP: directory, GITHUB_OUTPUT: outputPath, GITHUB_EVENT_PATH: eventPath },
      fetcher,
      config,
      { intents: [] },
    )
    assert.equal(output.published, false)
    assert.equal(output.records, 1)
    const path = readFileSync(outputPath, 'utf8').split('\n')[0].slice(5)
    published = archive(JSON.parse(readFileSync(path, 'utf8')), 0, true)
    const consumed = await cleanupAPI(env, fetcher, { policy: config }).ownershipManifest()
    assert.equal(consumed.records[0].deployment.id, 'dpl_last')
    assert.equal(consumed.records[0].nativeBranch.id, 'br-preview')
    assert.deepEqual(
      JSON.parse(readFileSync('scripts/preview-ownership-manifest.json', 'utf8')).records,
      [],
    )
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
