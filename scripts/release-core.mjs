import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'

export const repository = 'AxelOord/studio-lunia'
export const legacyThrough = '168fc9b7b1ef3cce1ef4e9d6267cf4d015dd6b28'
export const candidatePath = '.release/candidate.json'
export const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
export const jsonAt = (ref, file) => JSON.parse(git('show', `${ref}:${file}`))
export const sha = (value) => assert.match(value, /^[a-f0-9]{40}$/)
export const ancestor = (older, newer) => {
  sha(older)
  sha(newer)
  git('merge-base', '--is-ancestor', older, newer)
}

export function completedIssues(body = '') {
  const lines = body.split('\n').filter((line) => /^Completed issues:/i.test(line))
  assert.ok(lines.length <= 1, 'Use one Completed issues line')
  if (!lines.length || /^Completed issues:\s*none\s*$/i.test(lines[0])) return []
  assert.match(lines[0], /^Completed issues:\s*#\d+(?:\s*,\s*#\d+)*\s*$/i)
  const values = lines[0].match(/\d+/g).map(Number)
  assert.ok(
    values.every((n) => Number.isSafeInteger(n) && n > 0),
    'Invalid issue number',
  )
  return [...new Set(values)]
}

export function noClosingReferences(text) {
  assert.ok(
    !/\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?):?\s+(?:(?:[\w.-]+\/[\w.-]+)?#\d+|https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/issues\/\d+)/i.test(
      text,
    ),
    'Closing references can close issues before release publication; use Completed issues instead',
  )
}

export function nextVersion(current, messages) {
  assert.match(current, /^0\.\d+\.\d+$/)
  let level = 0
  for (const message of messages) {
    const header = /^(\w+)(?:\([^\r\n)]+\))?(!)?: .+/.exec(message)
    assert.ok(header, 'New release history must use Conventional Commits')
    if (header[1] === 'feat' || header[2] || /^BREAKING[ -]CHANGE: /m.test(message)) level = 2
    else if (['fix', 'perf'].includes(header[1])) level = Math.max(level, 1)
  }
  assert.ok(
    level,
    'No releasable change: feat/breaking increments minor; fix/perf increments patch',
  )
  const [, minor, patch] = current.split('.').map(Number)
  return level === 2 ? `0.${minor + 1}.0` : `0.${minor}.${patch + 1}`
}

export function history(base, head) {
  ancestor(base, head)
  return git('rev-list', '--reverse', '--no-merges', `${base}..${head}`)
    .split('\n')
    .filter(Boolean)
    .map((commit) => ({ sha: commit, message: git('show', '-s', '--format=%B', commit) }))
}

export function releaseNotes(manifest) {
  return [
    `## ${manifest.version}`,
    '',
    manifest.summary,
    '',
    ...manifest.changes.map((change) => `- ${change.message.split('\n')[0]} (${change.sha})`),
    '',
    '### Included completed issues',
    '',
    ...manifest.issues.map(
      (issue) => `- #${issue.number} via ${issue.prs.map((n) => `#${n}`).join(', ')}`,
    ),
    '',
    '### Migration',
    '',
    manifest.migration,
    '',
    '### Rollback',
    '',
    manifest.rollback,
    '',
  ].join('\n')
}

export function validateManifest(manifest) {
  assert.equal(manifest.schema, 1)
  assert.match(manifest.version, /^0\.\d+\.\d+$/)
  sha(manifest.sourceSha)
  assert.ok(manifest.previousTag === null || /^v0\.\d+\.\d+$/.test(manifest.previousTag))
  for (const field of ['summary', 'migration', 'rollback']) {
    assert.equal(typeof manifest[field], 'string')
    assert.ok(manifest[field].trim().length >= 10, `${field} needs explicit reviewed notes`)
    noClosingReferences(manifest[field])
  }
  assert.ok(Array.isArray(manifest.issues) && manifest.issues.length <= 100)
  const seen = new Set()
  for (const issue of manifest.issues) {
    assert.ok(Number.isSafeInteger(issue.number) && issue.number > 0 && !seen.has(issue.number))
    seen.add(issue.number)
    assert.ok(Array.isArray(issue.prs) && issue.prs.length > 0)
    assert.ok(issue.prs.every((n) => Number.isSafeInteger(n) && n > 0))
  }
}

export function validateCandidate(manifest, head) {
  validateManifest(manifest)
  ancestor(manifest.sourceSha, head)
  let reachableTag = null
  try {
    reachableTag = git('describe', '--tags', '--abbrev=0', '--match', 'v0.*', manifest.sourceSha)
  } catch {
    // An initial release has no reachable version tag.
  }
  assert.equal(
    manifest.previousTag,
    reachableTag,
    'Previous release baseline must match source history',
  )
  const base = manifest.previousTag
    ? git('rev-parse', `${manifest.previousTag}^{commit}`)
    : legacyThrough
  const changes = history(base, manifest.sourceSha)
  assert.deepEqual(manifest.changes, changes, 'Candidate history changed')
  for (const change of changes) noClosingReferences(change.message)
  const original = jsonAt(manifest.sourceSha, 'package.json')
  const expected = manifest.previousTag
    ? nextVersion(
        jsonAt(base, 'package.json').version,
        changes.map((c) => c.message),
      )
    : original.version
  assert.equal(manifest.version, expected, 'Incorrect 0.x release version')
  if (manifest.previousTag) assert.equal(original.version, jsonAt(base, 'package.json').version)
  assert.deepEqual(jsonAt(head, 'package.json'), { ...original, version: expected })
  const lock = jsonAt(manifest.sourceSha, 'package-lock.json')
  lock.version = expected
  lock.packages[''].version = expected
  assert.deepEqual(
    jsonAt(head, 'package-lock.json'),
    lock,
    'Preparation must not change dependencies',
  )
  const allowed = ['package.json', 'package-lock.json', 'CHANGELOG.md', candidatePath]
  const changed = git('diff', '--name-only', manifest.sourceSha, head).split('\n').filter(Boolean)
  assert.ok(
    changed.every((file) => allowed.includes(file)),
    'Candidate contains work after preparation',
  )
  let previous = ''
  try {
    previous = git('show', `${manifest.sourceSha}:CHANGELOG.md`) + '\n'
  } catch {
    // First release has no changelog.
  }
  const normalize = (text) => text.replace(/\s+/g, ' ').trim()
  assert.equal(
    normalize(git('show', `${head}:CHANGELOG.md`)),
    normalize(`${releaseNotes(manifest)}\n${previous}`),
  )
  return manifest
}
