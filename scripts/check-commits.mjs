import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const cli = fileURLToPath(new URL('../node_modules/@commitlint/cli/cli.js', import.meta.url))
const config = fileURLToPath(new URL('../commitlint.config.mjs', import.meta.url))
const git = (...args) => {
  const result = spawnSync('git', args, { encoding: 'utf8' })
  if (result.status !== 0) throw new Error(result.stderr || 'Git command failed')
  return result.stdout.trim()
}
const lint = (message, label) => {
  console.log(`Checking ${label}`)
  const result = spawnSync(process.execPath, [cli, '--config', config, '--strict'], {
    input: message,
    encoding: 'utf8',
  })
  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)
  if (result.status !== 0) process.exitCode = 1
}

try {
  const [mode, ...args] = process.argv.slice(2)
  if (mode === '--edit' && args.length === 1) {
    // The exemption is topology-based; a normal commit named "Merge ..." still fails.
    const merging = spawnSync('git', ['rev-parse', '--quiet', '--verify', 'MERGE_HEAD'])
    if (merging.status !== 0) lint(readFileSync(args[0], 'utf8'), 'commit message')
  } else if (mode === '--stdin' && args.length === 0) {
    lint(readFileSync(0, 'utf8'), 'commit message')
  } else if ((mode === '--range' && args.length === 2) || (mode === '--pr' && args.length === 0)) {
    const [base, head] = mode === '--pr' ? [process.env.PR_BASE_SHA, process.env.PR_HEAD_SHA] : args
    if (![base, head].every((value) => /^[a-f0-9]{40}$/.test(value ?? '')))
      throw new Error('Supply full base and head commit SHAs.')
    git('cat-file', '-e', `${base}^{commit}`)
    git('cat-file', '-e', `${head}^{commit}`)
    if (mode === '--pr') {
      if (!process.env.PR_TITLE) throw new Error('PR_TITLE is required.')
      lint(process.env.PR_TITLE, 'PR title (squash commit subject)')
    }
    // Grandfather only history already published when this policy was introduced.
    const { legacyThrough } = JSON.parse(readFileSync('.commit-policy.json', 'utf8'))
    if (!/^[a-f0-9]{40}$/.test(legacyThrough ?? '')) throw new Error('Invalid legacy baseline.')
    git('cat-file', '-e', `${legacyThrough}^{commit}`)
    const commits = git(
      'rev-list',
      '--reverse',
      '--no-merges',
      `${base}..${head}`,
      '--not',
      legacyThrough,
    )
    for (const sha of commits.split('\n').filter(Boolean))
      lint(git('show', '--no-patch', '--format=%B', sha), sha.slice(0, 12))
  } else throw new Error('Use --edit <file>, --stdin, --range <base-sha> <head-sha>, or --pr.')
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
