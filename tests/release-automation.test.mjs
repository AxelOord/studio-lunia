import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  completedIssues,
  nextVersion,
  noClosingReferences,
  validateCandidate,
  releaseNotes,
} from '../scripts/release-core.mjs'
import {
  markDevelopment,
  publish,
  closeReleased,
  validPromotion,
  noClosingLinks,
  github,
  promotion,
} from '../scripts/release-github.mjs'

import { projectBoard, projectConfig, projectGraphql } from '../scripts/release-project.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const git = (cwd, ...args) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
function fixture() {
  const cwd = mkdtempSync(path.join(tmpdir(), 'lunia release '))
  git(cwd, 'init', '--initial-branch=develop')
  git(cwd, 'config', 'user.email', 'release@example.test')
  git(cwd, 'config', 'user.name', 'Synthetic release test')
  git(cwd, 'config', 'core.hooksPath', 'disabled-hooks')
  writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ name: 'test', version: '0.1.0' }))
  writeFileSync(
    path.join(cwd, 'package-lock.json'),
    JSON.stringify({ version: '0.1.0', packages: { '': { version: '0.1.0' } } }),
  )
  git(cwd, 'add', '.')
  git(cwd, 'commit', '-m', 'chore: initial release')
  git(cwd, 'tag', 'v0.1.0')
  writeFileSync(path.join(cwd, 'feature.txt'), 'feature\n')
  git(cwd, 'add', '.')
  git(cwd, 'commit', '-m', 'feat: add a portfolio')
  const source = git(cwd, 'rev-parse', 'HEAD')
  const input = path.join(tmpdir(), `lunia-release-input-${path.basename(cwd)}.json`)
  writeFileSync(
    input,
    JSON.stringify({
      summary: 'A synthetic portfolio feature.',
      migration: 'No database migration is required.',
      rollback: 'Restore the previous compatible application commit.',
      issues: [{ number: 20, prs: [21] }],
    }),
  )
  execFileSync(process.execPath, [path.join(root, 'scripts/prepare-release.mjs'), input], {
    cwd,
    stdio: 'pipe',
  })
  git(cwd, 'add', '.')
  git(cwd, 'commit', '-m', 'chore: prepare release 0.2.0')
  const head = git(cwd, 'rev-parse', 'HEAD')
  const manifest = JSON.parse(readFileSync(path.join(cwd, '.release/candidate.json'), 'utf8'))
  return {
    cwd,
    head,
    source,
    manifest,
    close() {
      rmSync(cwd, { recursive: true, force: true })
      rmSync(input)
    },
  }
}

test('completion metadata is explicit; mentions and native closing phrases are not a release manifest', () => {
  assert.deepEqual(completedIssues('Related: #20\nSome other #12'), [])
  assert.deepEqual(completedIssues('Completed issues: #20, #6, #20'), [20, 6])
  assert.deepEqual(completedIssues('Completed issues: none'), [])
  for (const body of [
    'Completed issues: #20 and #6',
    'Completed issues: #0',
    'Completed issues: #1\nCompleted issues: #2',
  ])
    assert.throws(() => completedIssues(body))
  for (const text of [
    'Fixes #20',
    'CLOSES: AxelOord/studio-lunia#20',
    'Resolved #20',
    'Fixes https://github.com/AxelOord/studio-lunia/issues/20',
  ])
    assert.throws(() => noClosingReferences(text))
  noClosingReferences('Completed issues: #20')
})

test('0.x versioning uses the strongest change and never silently graduates to 1.0', () => {
  assert.equal(nextVersion('0.2.7', ['fix: repair a form']), '0.2.8')
  assert.equal(nextVersion('0.2.7', ['fix: repair', 'feat: portfolio']), '0.3.0')
  assert.equal(nextVersion('0.2.7', ['refactor!: change API']), '0.3.0')
  assert.equal(
    nextVersion('0.2.7', ['refactor: API\n\nBREAKING CHANGE: contract changed']),
    '0.3.0',
  )
  assert.throws(() => nextVersion('0.2.7', ['chore: tooling only']))
  assert.throws(() => nextVersion('0.2.7', ['unstructured new message']))
  assert.throws(() => nextVersion('1.0.0', ['fix: repair']))
})

test('real Git candidate preparation keeps version/lock aligned and rejects work after freezing', () => {
  const f = fixture()
  const original = process.cwd()
  try {
    process.chdir(f.cwd)
    assert.equal(f.manifest.version, '0.2.0')
    validateCandidate(f.manifest, f.head)
    assert.throws(() => validateCandidate({ ...f.manifest, version: '0.3.0' }, f.head))
    writeFileSync('late-feature.txt', 'not in candidate\n')
    git(f.cwd, 'add', '.')
    git(f.cwd, 'commit', '-m', 'feat: arrive after preparation')
    assert.throws(() => validateCandidate(f.manifest, git(f.cwd, 'rev-parse', 'HEAD')))
  } finally {
    process.chdir(original)
    f.close()
  }
})

function memoryApi(manifest, head) {
  const writes = []
  let tag = null,
    release = null
  let failRelease = false
  const item = {
    number: 20,
    state: 'open',
    state_reason: null,
    node_id: 'I_synthetic_20',
  }
  const api = async (url, method = 'GET', body) => {
    if (method !== 'GET') writes.push({ url, method, body })
    if (url === '/graphql')
      return {
        data: { repository: { pullRequest: { closingIssuesReferences: { totalCount: 0 } } } },
      }
    if (url === '/git/refs') {
      tag = { object: { type: 'commit', sha: body.sha } }
      return tag
    }
    if (url.startsWith('/git/ref/tags/')) return tag
    if (url === '/releases' && method === 'POST') {
      if (failRelease) throw new Error('Synthetic publication interruption')
      release = { ...body }
      return release
    }
    if (url.startsWith('/releases/tags/')) return release
    if (url === '/pulls/21')
      return {
        merged: true,
        merge_commit_sha: manifest.sourceSha,
        base: { ref: 'develop', repo: { full_name: 'AxelOord/studio-lunia' } },
        head: { repo: { full_name: 'AxelOord/studio-lunia' } },
        body: 'Completed issues: #20',
      }
    if (url === '/issues/20' && method === 'PATCH') {
      Object.assign(item, body)
      return item
    }
    if (url === '/issues/20') return item
    throw new Error(`Unexpected request ${method} ${url}`)
  }
  return {
    api,
    writes,
    item,
    fail(value) {
      failRelease = value
    },
    wrongTag() {
      tag = { object: { type: 'commit', sha: 'f'.repeat(40) } }
    },
    head,
  }
}

test('development updates the actual board for open issues without repository writes', async () => {
  const m = memoryApi({}, '')
  const updates = []
  const board = {
    async setStatus(issues, status) {
      updates.push({ numbers: issues.map((i) => i.number), status })
    },
  }
  await markDevelopment(m.api, [20], board)
  assert.deepEqual(updates, [{ numbers: [20], status: 'Development done' }])
  assert.equal(m.writes.length, 0)
  m.item.state = 'closed'
  await markDevelopment(m.api, [20], board)
  assert.deepEqual(updates[1].numbers, [])
  assert.equal(m.writes.length, 0)
})

test('failed publication cannot close issues; retries reuse immutable tag/release and close only manifest members', async () => {
  const f = fixture(),
    original = process.cwd()
  try {
    process.chdir(f.cwd)
    const m = memoryApi(f.manifest, f.head)
    const board = {
      async setStatus(issues, status) {
        assert.equal(status, 'Done')
        assert.deepEqual(
          issues.map((i) => i.number),
          [20],
        )
      },
    }
    await assert.rejects(closeReleased(m.api, f.head, f.manifest, board))
    assert.equal(m.writes.length, 0)
    m.fail(true)
    await assert.rejects(publish(m.api, f.head, f.manifest))
    assert.equal(m.item.state, 'open')
    assert.equal(m.writes.filter((w) => w.url === '/git/refs').length, 1)
    m.fail(false)
    await publish(m.api, f.head, f.manifest)
    await assert.rejects(
      closeReleased(m.api, f.head, f.manifest, {
        async setStatus() {
          throw new Error('Project access denied')
        },
      }),
      /Project access denied/,
    )
    assert.equal(m.item.state, 'open')
    assert.equal(m.writes.filter((w) => w.method === 'PATCH').length, 0)
    await closeReleased(m.api, f.head, f.manifest, board)
    assert.equal(m.item.state, 'closed')
    assert.equal(m.item.state_reason, 'completed')
    await publish(m.api, f.head, f.manifest)
    assert.equal(m.writes.filter((w) => w.url === '/git/refs').length, 1)
    assert.equal(m.writes.filter((w) => w.url === '/releases').length, 2) // one failed, one successful
    assert.ok(m.writes.filter((w) => w.method === 'PATCH').every((w) => w.url === '/issues/20'))
    m.wrongTag()
    await assert.rejects(publish(m.api, f.head, f.manifest))
    await assert.rejects(closeReleased(m.api, f.head, f.manifest, board))
    assert.ok(releaseNotes(f.manifest).includes('0.2.0'))
  } finally {
    process.chdir(original)
    f.close()
  }
})

test('promotion requires exact repository, branch and merge identity; native closing links fail closed', async () => {
  const pr = {
    merged: true,
    merge_commit_sha: 'a'.repeat(40),
    base: { ref: 'master', repo: { full_name: 'AxelOord/studio-lunia' } },
    head: { ref: 'release/v0.2.0', repo: { full_name: 'AxelOord/studio-lunia' } },
  }
  assert.equal(validPromotion(pr, 'a'.repeat(40), '0.2.0'), true)
  assert.equal(validPromotion(pr, 'b'.repeat(40), '0.2.0'), false)
  assert.equal(
    validPromotion({ ...pr, head: { ...pr.head, ref: 'develop' } }, 'a'.repeat(40), '0.2.0'),
    false,
  )
  await noClosingLinks(memoryApi({}, '').api, 21)
  await assert.rejects(
    noClosingLinks(
      async () => ({
        data: { repository: { pullRequest: { closingIssuesReferences: { totalCount: 1 } } } },
      }),
      21,
    ),
  )
  await assert.rejects(noClosingLinks(async () => ({ errors: [{ message: 'denied' }] }), 21))
})

test('GitHub transport never redirects an authorization header and fails closed on unexpected errors', async () => {
  const api = github('synthetic', async (url, options) => {
    assert.equal(url, 'https://api.github.com/repos/AxelOord/studio-lunia/issues/20')
    assert.equal(options.redirect, 'error')
    return { status: 403, ok: false }
  })
  await assert.rejects(api('/issues/20'), /403/)
  await assert.rejects(api('/../other-repository'))
})

test('full promotion validates real merge topology and frozen issue ancestry before publication', async () => {
  const f = fixture(),
    original = process.cwd()
  try {
    process.chdir(f.cwd)
    git(f.cwd, 'update-ref', 'refs/remotes/origin/develop', f.head)
    git(f.cwd, 'switch', '-c', 'master', 'v0.1.0')
    git(f.cwd, 'merge', '--no-ff', 'develop', '-m', 'chore: promote release 0.2.0')
    const merged = git(f.cwd, 'rev-parse', 'HEAD')
    const m = memoryApi(f.manifest, merged)
    let completion = 'Completed issues: #20'
    const api = async (url, method, body) => {
      if (url.startsWith(`/commits/${merged}/pulls`)) return [{ number: 22 }]
      if (url === '/pulls/22')
        return {
          number: 22,
          merged: true,
          merge_commit_sha: merged,
          base: { ref: 'master', repo: { full_name: 'AxelOord/studio-lunia' } },
          head: {
            ref: 'release/v0.2.0',
            sha: f.head,
            repo: { full_name: 'AxelOord/studio-lunia' },
          },
          body: 'Promote the reviewed candidate. Completed issues are in the manifest.',
        }
      if (url === '/releases/tags/v0.1.0') return { draft: false, prerelease: false }
      const value = await m.api(url, method, body)
      if (url === '/pulls/21') value.body = completion
      return value
    }
    assert.deepEqual(await promotion(api, merged), f.manifest)
    completion = 'Related: #20; remaining acceptance is unfinished'
    await assert.rejects(promotion(api, merged), /does not declare/)
    assert.equal(m.writes.filter((w) => w.url !== '/graphql').length, 0)
  } finally {
    process.chdir(original)
    f.close()
  }
})

test('workflow writer gates, permission separation and production deployment block remain explicit', () => {
  const workflow = readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8')
  const global = workflow.slice(workflow.indexOf('permissions:'), workflow.indexOf('concurrency:'))
  assert.ok(!global.includes('write'))
  const development = workflow.split('  development-status:')[1].split('  publish-release:')[0]
  const publication = workflow.split('  publish-release:')[1].split('  release-status:')[0]
  const closure = workflow.split('  release-status:')[1]
  for (const block of [development, publication, closure]) {
    assert.match(block, /github.event_name == 'push'/)
    assert.match(block, /AUTOMATION_ENABLED == 'true'/)
    assert.match(block, /persist-credentials: false/)
  }
  assert.match(development, /needs: verify/)
  assert.match(development, /issues: read/)
  assert.match(development, /environment: project-status/)
  assert.match(closure, /environment: project-status/)
  assert.ok(!publication.includes('LUNIA_PROJECT_TOKEN'))
  for (const statusJob of [development, closure])
    assert.match(statusJob, /secrets.LUNIA_PROJECT_TOKEN/)
  assert.match(development, /refs\/heads\/develop/)
  assert.match(publication, /needs: verify/)
  assert.match(publication, /environment: release-automation/)
  assert.match(publication, /contents: write/)
  assert.match(publication, /issues: read/)
  assert.match(closure, /needs: publish-release/)
  assert.match(closure, /contents: read/)
  assert.match(closure, /issues: write/)
  assert.equal(
    JSON.parse(readFileSync(path.join(root, 'vercel.json'), 'utf8')).git.deploymentEnabled.master,
    false,
  )
})

const projectSettings = {
  projectId: 'PVT_synthetic',
  projectUrl: 'https://github.com/users/AxelOord/projects/999',
  fieldId: 'PVTSSF_status',
  developmentId: 'development-option',
  doneId: 'done-option',
}

function projectApi() {
  const mutations = []
  const fields = [
    {
      id: projectSettings.fieldId,
      name: 'Status',
      options: [
        { id: projectSettings.developmentId, name: 'Development done' },
        { id: projectSettings.doneId, name: 'Done' },
      ],
    },
  ]
  const items = [
    {
      id: 'PVTI_20',
      isArchived: false,
      content: {
        id: 'I_synthetic_20',
        number: 20,
        repository: { nameWithOwner: 'AxelOord/studio-lunia' },
      },
      fieldValueByName: { optionId: 'in-progress' },
    },
  ]
  let pageCount = 0
  const query = async (query, variables) => {
    if (query.includes('query ProjectStatusConfig'))
      return {
        node: {
          id: projectSettings.projectId,
          url: projectSettings.projectUrl,
          closed: false,
          fields: { pageInfo: { hasNextPage: false }, nodes: fields },
        },
      }
    if (query.includes('query ProjectStatusItems')) {
      assert.match(query, /archivedStates: \[ARCHIVED, NOT_ARCHIVED\]/)
      pageCount++
      // Always exercise a second page; do not silently assume the first hundred items.
      return {
        node: {
          items: variables.cursor
            ? {
                nodes: items,
                pageInfo: { hasNextPage: false, endCursor: 'end' },
              }
            : { nodes: [], pageInfo: { hasNextPage: true, endCursor: 'next' } },
        },
      }
    }
    mutations.push({ query, variables })
    if (query.includes('mutation AddCompletedIssue')) {
      items.push({
        id: 'PVTI_new',
        isArchived: false,
        content: {
          id: variables.issue,
          number: 21,
          repository: { nameWithOwner: 'AxelOord/studio-lunia' },
        },
        fieldValueByName: null,
      })
      return { addProjectV2ItemById: { item: { id: 'PVTI_new' } } }
    }
    if (query.includes('mutation SetCompletionStatus')) {
      const item = items.find((value) => value.id === variables.item)
      item.fieldValueByName = { optionId: variables.option }
      return {
        updateProjectV2ItemFieldValue: {
          projectV2Item: { id: item.id, fieldValueByName: item.fieldValueByName },
        },
      }
    }
    throw new Error('Unexpected Project request')
  }
  return { query, mutations, fields, items, pageCount: () => pageCount }
}

test('Project backend updates the approved actual Status field, adds missing issues and retries idempotently', async () => {
  const api = projectApi(),
    board = projectBoard(api.query, projectSettings)
  const issues = [
    { number: 20, node_id: 'I_synthetic_20' },
    { number: 21, node_id: 'I_synthetic_21' },
  ]
  await board.setStatus(issues, 'Development done')
  assert.equal(api.pageCount(), 2)
  assert.equal(api.mutations.filter((value) => value.query.includes('AddCompletedIssue')).length, 1)
  assert.equal(
    api.mutations.filter((value) => value.query.includes('SetCompletionStatus')).length,
    2,
  )
  assert.ok(api.mutations.every((value) => value.variables.project === projectSettings.projectId))
  const previous = api.mutations.length
  await board.setStatus(issues, 'Development done')
  assert.equal(api.mutations.length, previous)
  await board.setStatus(issues, 'Done')
  assert.ok(api.items.every((value) => value.fieldValueByName.optionId === projectSettings.doneId))
  const completed = api.mutations.length
  await board.setStatus(issues, 'Development done')
  assert.equal(api.mutations.length, completed, 'Development reconciliation cannot downgrade Done')
})

test('wrong Project/options, archived issues and foreign membership stop before any Project write', async () => {
  for (const failure of ['project', 'option', 'archive', 'foreign']) {
    const api = projectApi(),
      config = { ...projectSettings }
    if (failure === 'project') config.projectUrl = 'https://github.com/users/someone/projects/1'
    if (failure === 'option') api.fields[0].options[0].name = 'Some other state'
    if (failure === 'archive') api.items[0].isArchived = true
    if (failure === 'foreign') api.items[0].content.repository.nameWithOwner = 'someone/other'
    await assert.rejects(
      projectBoard(api.query, config).setStatus(
        [{ number: 20, node_id: 'I_synthetic_20' }],
        'Development done',
      ),
    )
    assert.equal(api.mutations.length, 0)
  }
})

test('Project credential/configuration is mandatory and denial never leaks the provider response or token', async () => {
  assert.throws(() => projectConfig({}), /Missing Project configuration/)
  assert.throws(() => projectGraphql(''), /required/)
  const denied = projectGraphql('synthetic-project-token', async (url, options) => {
    assert.equal(url, 'https://api.github.com/graphql')
    assert.equal(options.redirect, 'error')
    return { ok: true, json: async () => ({ errors: [{ message: 'sensitive provider details' }] }) }
  })
  await assert.rejects(denied('query { viewer { login } }', {}), (error) => {
    assert.ok(
      !error.message.includes('sensitive') && !error.message.includes('synthetic-project-token'),
    )
    return true
  })
})
