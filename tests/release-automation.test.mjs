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
    labels: [{ name: 'Development done' }],
  }
  const api = async (url, method = 'GET', body) => {
    if (method !== 'GET') writes.push({ url, method, body })
    if (url === '/graphql')
      return {
        data: { repository: { pullRequest: { closingIssuesReferences: { totalCount: 0 } } } },
      }
    if (url.startsWith('/labels/')) return { name: decodeURIComponent(url.slice(8)) }
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
    if (url.startsWith('/issues/20/labels')) return []
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

test('development status labels an explicit open issue without closing or reopening any issue', async () => {
  const m = memoryApi({}, '')
  await markDevelopment(m.api, [20])
  assert.deepEqual(m.writes, [
    { url: '/issues/20/labels', method: 'POST', body: { labels: ['Development done'] } },
  ])
  m.item.state = 'closed'
  m.writes.length = 0
  await markDevelopment(m.api, [20])
  assert.equal(m.writes.length, 0)
})

test('failed publication cannot close issues; retries reuse immutable tag/release and close only manifest members', async () => {
  const f = fixture(),
    original = process.cwd()
  try {
    process.chdir(f.cwd)
    const m = memoryApi(f.manifest, f.head)
    await assert.rejects(closeReleased(m.api, f.head, f.manifest))
    assert.equal(m.writes.length, 0)
    m.fail(true)
    await assert.rejects(publish(m.api, f.head, f.manifest))
    assert.equal(m.item.state, 'open')
    assert.equal(m.writes.filter((w) => w.url === '/git/refs').length, 1)
    m.fail(false)
    await publish(m.api, f.head, f.manifest)
    await closeReleased(m.api, f.head, f.manifest)
    assert.equal(m.item.state, 'closed')
    assert.equal(m.item.state_reason, 'completed')
    await publish(m.api, f.head, f.manifest)
    assert.equal(m.writes.filter((w) => w.url === '/git/refs').length, 1)
    assert.equal(m.writes.filter((w) => w.url === '/releases').length, 2) // one failed, one successful
    assert.ok(m.writes.filter((w) => w.method === 'PATCH').every((w) => w.url === '/issues/20'))
    m.wrongTag()
    await assert.rejects(publish(m.api, f.head, f.manifest))
    await assert.rejects(closeReleased(m.api, f.head, f.manifest))
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
