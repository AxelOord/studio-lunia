import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  git,
  jsonAt,
  candidatePath,
  validateCandidate,
  noClosingReferences,
  completedIssues,
  ancestor,
} from './release-core.mjs'
import { github, noClosingLinks } from './release-github.mjs'

const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'))
const pr = event.pull_request
assert.ok(pr)
completedIssues(pr.body ?? '') // Reject ambiguous completion metadata on any PR.
if (pr.base.ref === 'master' && pr.head.ref.startsWith('release/')) {
  const manifest = jsonAt(pr.head.sha, candidatePath)
  assert.equal(pr.head.ref, `release/v${manifest.version}`)
  ancestor(pr.head.sha, git('rev-parse', 'origin/develop'))
  validateCandidate(manifest, pr.head.sha)
  noClosingReferences(pr.body ?? '')
  noClosingReferences(git('log', '--format=%B', `${pr.base.sha}..${pr.head.sha}`))
  await noClosingLinks(github(process.env.GITHUB_TOKEN), pr.number)
  console.log('Frozen release candidate and absence of premature closing links verified')
}
