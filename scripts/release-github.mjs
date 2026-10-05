import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { projectBoard, projectConfig, projectGraphql } from './release-project.mjs'
import {
  repository,
  candidatePath,
  git,
  sha,
  ancestor,
  completedIssues,
  noClosingReferences,
  releaseNotes,
  validateCandidate,
  jsonAt,
} from './release-core.mjs'

export function github(token, fetcher = fetch) {
  assert.ok(token, 'GITHUB_TOKEN required')
  return async (path, method = 'GET', body) => {
    assert.ok(path.startsWith('/') && !path.includes('..'))
    const response = await fetcher(
      path === '/graphql'
        ? 'https://api.github.com/graphql'
        : `https://api.github.com/repos/${repository}${path}`,
      {
        method,
        redirect: 'error',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      },
    )
    if (response.status === 404 && method === 'GET') return null
    assert.ok(response.ok, `GitHub ${method} ${path} failed (${response.status})`)
    return response.status === 204 ? null : response.json()
  }
}

async function list(api, path) {
  const result = []
  for (let page = 1; page <= 20; page++) {
    const items = await api(`${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`)
    assert.ok(Array.isArray(items))
    result.push(...items)
    if (items.length < 100) return result
  }
  throw new Error('Pagination limit exceeded; refusing an incomplete release/status inventory')
}

async function issue(api, number) {
  const value = await api(`/issues/${number}`)
  assert.ok(value && !value.pull_request, `#${number} must be a same-repository issue`)
  return value
}

export function validFeaturePR(pr) {
  return (
    pr.merged &&
    pr.base.ref === 'develop' &&
    pr.base.repo.full_name === repository &&
    pr.head.repo?.full_name === repository
  )
}

export function validPromotion(pr, head, version) {
  return (
    pr.merged &&
    pr.merge_commit_sha === head &&
    pr.base.ref === 'master' &&
    pr.base.repo.full_name === repository &&
    pr.head.repo?.full_name === repository &&
    pr.head.ref === `release/v${version}`
  )
}

export async function markDevelopment(api, numbers, board) {
  const targets = await Promise.all(numbers.map((number) => issue(api, number)))
  // Never close or reopen an issue during development reconciliation.
  await board.setStatus(
    targets.filter((item) => item.state === 'open'),
    'Development done',
  )
}

export async function development(api, before, head, board) {
  sha(before)
  sha(head)
  ancestor(before, head)
  const commits = new Set(git('rev-list', head).split('\n'))
  const prs = await list(api, '/pulls?state=closed&base=develop')
  const numbers = new Set()
  for (const summary of prs) {
    if (!commits.has(summary.merge_commit_sha)) continue
    const pr = await api(`/pulls/${summary.number}`)
    if (!validFeaturePR(pr)) continue
    noClosingReferences(pr.body ?? '')
    for (const number of completedIssues(pr.body)) numbers.add(number)
  }
  await markDevelopment(api, [...numbers], board)
  console.log(`Development completion recorded for ${numbers.size} explicitly completed issues`)
}

export async function noClosingLinks(api, number) {
  assert.ok(Number.isSafeInteger(number) && number > 0)
  const result = await api('/graphql', 'POST', {
    query: `query($number: Int!) { repository(owner: "AxelOord", name: "studio-lunia") {
      pullRequest(number: $number) { closingIssuesReferences(first: 1) { totalCount } }
    } }`,
    variables: { number },
  })
  assert.ok(!result.errors, 'Cannot verify promotion closing links')
  assert.equal(
    result.data?.repository?.pullRequest?.closingIssuesReferences?.totalCount,
    0,
    'Remove all Development/closing links from the promotion PR; the manifest controls closure',
  )
}

async function verifyIssueMembership(api, manifest) {
  for (const entry of manifest.issues) {
    const item = await issue(api, entry.number)
    assert.ok(
      item.state === 'open' || item.state_reason === 'completed',
      'An excluded issue cannot be released',
    )
    for (const number of entry.prs) {
      const pr = await api(`/pulls/${number}`)
      assert.ok(
        pr && validFeaturePR(pr),
        `PR #${number} must be merged into develop in this repository`,
      )
      ancestor(pr.merge_commit_sha, manifest.sourceSha)
      assert.ok(
        completedIssues(pr.body).includes(entry.number),
        `PR #${number} does not declare #${entry.number} completed`,
      )
    }
  }
}

export function publishedRelease(release, tagSha, head, manifest) {
  assert.equal(tagSha, head, 'Never move or reuse a tag at another SHA')
  assert.ok(release && !release.draft && !release.prerelease, 'Release must be published')
  assert.equal(release.tag_name, `v${manifest.version}`)
  assert.equal(release.body, `${releaseNotes(manifest)}\nRelease commit: ${head}`)
}

export async function publish(api, head, manifest) {
  const tag = `v${manifest.version}`
  const reference = await api(`/git/ref/tags/${tag}`)
  // This workflow creates lightweight immutable tags; reject other targets/types.
  if (reference) {
    assert.equal(reference.object.type, 'commit')
    assert.equal(reference.object.sha, head, 'Existing tag targets a different commit')
  } else await api('/git/refs', 'POST', { ref: `refs/tags/${tag}`, sha: head })
  let release = await api(`/releases/tags/${tag}`)
  if (!release)
    release = await api('/releases', 'POST', {
      tag_name: tag,
      target_commitish: head,
      name: tag,
      body: `${releaseNotes(manifest)}\nRelease commit: ${head}`,
      draft: false,
      prerelease: false,
      make_latest: 'true',
    })
  publishedRelease(release, (await api(`/git/ref/tags/${tag}`)).object.sha, head, manifest)
  return release
}

export async function closeReleased(api, head, manifest, board) {
  const release = await api(`/releases/tags/v${manifest.version}`)
  const reference = await api(`/git/ref/tags/v${manifest.version}`)
  publishedRelease(release, reference?.object?.sha, head, manifest)
  // Publication proof comes before any issue/Project mutation, including retries.
  await verifyIssueMembership(api, manifest)
  const targets = await Promise.all(manifest.issues.map((entry) => issue(api, entry.number)))
  // Project access/configuration failure cannot silently fall back to labels or close issues.
  await board.setStatus(targets, 'Done')
  for (const item of targets)
    await api(`/issues/${item.number}`, 'PATCH', { state: 'closed', state_reason: 'completed' })
}

export async function promotion(api, head) {
  const associated = await list(api, `/commits/${head}/pulls`)
  const candidates = []
  for (const item of associated) {
    const pr = await api(`/pulls/${item.number}`)
    if (
      pr.merged &&
      pr.merge_commit_sha === head &&
      pr.base.ref === 'master' &&
      /^release\/v0\.\d+\.\d+$/.test(pr.head.ref)
    )
      candidates.push(pr)
  }
  if (!candidates.length) return null // Ordinary master work does not publish anything.
  assert.equal(candidates.length, 1)
  const pr = candidates[0]
  const manifest = jsonAt(head, candidatePath)
  assert.ok(validPromotion(pr, head, manifest.version))
  const parents = git('rev-list', '--parents', '-n', '1', head).split(' ')
  assert.equal(parents.length, 3, 'Promotion must be a history-preserving merge')
  assert.equal(parents[2], pr.head.sha)
  // Do not accept automatic-close links on the promotion PR before publication.
  await noClosingLinks(api, pr.number)
  noClosingReferences(pr.body ?? '')
  noClosingReferences(git('show', '-s', '--format=%B', head))
  ancestor(pr.head.sha, git('rev-parse', 'origin/develop'))
  validateCandidate(manifest, pr.head.sha)
  // The merge must preserve the entire candidate tree, not resolve in unrelated edits.
  assert.equal(git('rev-parse', `${head}^{tree}`), git('rev-parse', `${pr.head.sha}^{tree}`))
  for (const change of git('log', '--format=%B', `${parents[1]}..${head}`).split('\0'))
    noClosingReferences(change)
  if (manifest.previousTag) {
    const previous = await api(`/releases/tags/${manifest.previousTag}`)
    assert.ok(previous && !previous.draft && !previous.prerelease, 'Previous release must exist')
    ancestor(git('rev-parse', `${manifest.previousTag}^{commit}`), parents[1])
  }
  await verifyIssueMembership(api, manifest)
  return manifest
}

async function main() {
  assert.equal(process.env.GITHUB_REPOSITORY, repository)
  assert.equal(process.env.GITHUB_EVENT_NAME, 'push')
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'))
  assert.equal(event.after, process.env.GITHUB_SHA)
  assert.equal(event.forced, false, 'Force pushes cannot trigger lifecycle writes')
  assert.equal(event.deleted, false)
  const head = event.after
  sha(head)
  assert.equal(git('rev-parse', 'HEAD'), head)
  const api = github(process.env.GITHUB_TOKEN)
  const mode = process.argv[2]
  const board =
    mode === 'publish'
      ? null
      : projectBoard(projectGraphql(process.env.LUNIA_PROJECT_TOKEN), projectConfig())
  if (mode === 'development') {
    assert.equal(event.ref, 'refs/heads/develop')
    await development(api, event.before, head, board)
  } else {
    assert.equal(event.ref, 'refs/heads/master')
    assert.ok(['publish', 'close'].includes(mode))
    const manifest = await promotion(api, head)
    if (!manifest) return console.log('No intentional release promotion at this SHA')
    if (mode === 'publish') await publish(api, head, manifest)
    else await closeReleased(api, head, manifest, board)
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
