import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import {
  candidatePath,
  git,
  history,
  jsonAt,
  legacyThrough,
  nextVersion,
  releaseNotes,
  validateManifest,
  noClosingReferences,
} from './release-core.mjs'

// Local preparation only: never pushes, tags, publishes, or changes issue state.
const [inputFile] = process.argv.slice(2)
assert.ok(inputFile, 'Usage: npm run release:prepare -- <reviewed-input.json>')
assert.equal(git('status', '--porcelain'), '', 'Start from a clean checkout')
const input = JSON.parse(readFileSync(inputFile, 'utf8'))
const sourceSha = git('rev-parse', 'HEAD')
const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
let previousTag = null
try {
  previousTag = git('describe', '--tags', '--abbrev=0', '--match', 'v0.*', sourceSha)
} catch {
  assert.equal(
    input.initialRelease,
    true,
    'First release requires initialRelease: true and curated summary',
  )
}
if (previousTag)
  assert.equal(pkg.version, previousTag.slice(1), 'Pending/unpublished version preparation')
const base = previousTag ? git('rev-parse', `${previousTag}^{commit}`) : legacyThrough
const changes = history(base, sourceSha)
for (const change of changes) noClosingReferences(change.message)
const version = previousTag
  ? nextVersion(
      pkg.version,
      changes.map((c) => c.message),
    )
  : pkg.version
const manifest = {
  schema: 1,
  version,
  previousTag,
  sourceSha,
  changes,
  summary: input.summary,
  migration: input.migration,
  rollback: input.rollback,
  issues: input.issues,
}
validateManifest(manifest)
// Refuse duplicate unpublished preparation, including the first release.
if (git('ls-tree', '--name-only', sourceSha, candidatePath)) {
  const previous = jsonAt(sourceSha, candidatePath)
  assert.equal(
    `v${previous.version}`,
    previousTag,
    'Publish or explicitly withdraw the pending candidate first',
  )
}

pkg.version = version
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'))
lock.version = version
lock.packages[''].version = version
let oldNotes = ''
try {
  oldNotes = readFileSync('CHANGELOG.md', 'utf8')
} catch {
  /* initial release */
}
mkdirSync('.release', { recursive: true })
writeFileSync(candidatePath, JSON.stringify(manifest, null, 2) + '\n')
writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')
writeFileSync('package-lock.json', JSON.stringify(lock, null, 2) + '\n')
writeFileSync('CHANGELOG.md', `${releaseNotes(manifest)}\n${oldNotes}`)
console.log(
  `Prepared ${version} from ${sourceSha}. Review and format these four files in a preparation PR to develop.`,
)
