import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  symlinkSync,
  rmSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = fileURLToPath(new URL('../', import.meta.url))
const environment: NodeJS.ProcessEnv = {
  ...process.env,
  CI: '',
  VERCEL: '',
  HUSKY: '',
  NODE_ENV: 'development',
}
const run = (
  cwd: string,
  command: string,
  args: string[],
  extra: { input?: string; env?: NodeJS.ProcessEnv } = {},
) => spawnSync(command, args, { cwd, encoding: 'utf8', env: environment, ...extra })
const ok = (result: ReturnType<typeof run>) =>
  assert.equal(result.status, 0, result.stdout + result.stderr)
const check = (cwd: string, args: string[], input?: string, env?: NodeJS.ProcessEnv) =>
  run(cwd, process.execPath, [path.join(root, 'scripts/check-commits.mjs'), ...args], {
    input,
    ...(env ? { env } : {}),
  })

function repository() {
  const cwd = mkdtempSync(path.join(tmpdir(), 'lunia hooks with spaces '))
  for (const folder of ['.husky', 'scripts']) mkdirSync(path.join(cwd, folder))
  for (const name of [
    'commitlint.config.mjs',
    '.lintstagedrc.json',
    '.prettierrc.json',
    '.prettierignore',
    'eslint.config.mjs',
    '.gitattributes',
    '.husky/install.mjs',
    '.husky/pre-commit',
    '.husky/commit-msg',
    'scripts/check-commits.mjs',
  ])
    copyFileSync(path.join(root, name), path.join(cwd, name))
  symlinkSync(path.join(root, 'node_modules'), path.join(cwd, 'node_modules'), 'junction')
  writeFileSync(path.join(cwd, '.gitignore'), 'node_modules/\n.husky/_/\n')
  writeFileSync(
    path.join(cwd, 'package.json'),
    JSON.stringify(
      { private: true, type: 'module', scripts: { 'staged:check': 'lint-staged' } },
      null,
      2,
    ) + '\n',
  )
  ok(run(cwd, 'git', ['init', '--initial-branch=main']))
  ok(run(cwd, 'git', ['config', 'user.email', 'hooks@example.test']))
  ok(run(cwd, 'git', ['config', 'user.name', 'Synthetic hook test']))
  ok(run(cwd, 'git', ['add', '.']))
  ok(
    run(cwd, 'git', [
      '-c',
      'core.hooksPath=disabled-hooks',
      'commit',
      '-m',
      'Legacy baseline without a prefix',
    ]),
  )
  const base = run(cwd, 'git', ['rev-parse', 'HEAD']).stdout.trim()
  writeFileSync(
    path.join(cwd, '.commit-policy.json'),
    JSON.stringify({ legacyThrough: base }, null, 2) + '\n',
  )
  ok(run(cwd, process.execPath, ['.husky/install.mjs']))
  assert.equal(run(cwd, 'git', ['config', '--get', 'core.hooksPath']).stdout.trim(), '.husky/_')
  return { cwd, base, close: () => rmSync(cwd, { recursive: true, force: true }) }
}

test('Conventional Commit samples fail closed, including fake merges and fixups', () => {
  for (const message of [
    'feat: add image selection',
    'fix(media): preserve thumbnails',
    'docs: explain Payload setup',
    'feat!: change the API\n\nBREAKING CHANGE: clients must update',
    'revert: remove the experiment',
  ])
    ok(check(root, ['--stdin'], message))
  for (const message of [
    'Update stuff',
    'feat:',
    'unknown: add a change',
    'Merge pull request #99 from example/fake',
    'fixup! feat: unfinished',
  ])
    assert.notEqual(check(root, ['--stdin'], message).status, 0, message)
})

test('real hooks check staged files and messages without changing partial unstaged edits', () => {
  const { cwd, close } = repository()
  try {
    const file = path.join(cwd, 'file with spaces.js')
    writeFileSync(file, 'export const value=1;\n')
    ok(run(cwd, 'git', ['add', 'file with spaces.js']))
    const before = run(cwd, 'git', ['rev-parse', 'HEAD']).stdout
    assert.notEqual(run(cwd, 'git', ['commit', '-m', 'feat: reject bad formatting']).status, 0)
    assert.equal(run(cwd, 'git', ['rev-parse', 'HEAD']).stdout, before)
    assert.equal(readFileSync(file, 'utf8'), 'export const value=1;\n')
    writeFileSync(file, 'const unused = 1\n')
    ok(run(cwd, 'git', ['add', 'file with spaces.js']))
    assert.notEqual(run(cwd, 'git', ['commit', '-m', 'test: reject lint errors']).status, 0)
    writeFileSync(file, 'export const value = 1\n')
    ok(run(cwd, 'git', ['add', 'file with spaces.js']))
    assert.notEqual(run(cwd, 'git', ['commit', '-m', 'Not conventional']).status, 0)
    ok(run(cwd, 'git', ['commit', '-m', 'feat: accept clean staged content']))
    writeFileSync(file, 'export const value = 2\n')
    ok(run(cwd, 'git', ['add', 'file with spaces.js']))
    writeFileSync(file, 'export const value = 2\nexport const unstaged=3;\n')
    ok(run(cwd, 'git', ['commit', '-m', 'fix: preserve unstaged work']))
    assert.equal(
      run(cwd, 'git', ['show', 'HEAD:file with spaces.js']).stdout,
      'export const value = 2\n',
    )
    assert.equal(readFileSync(file, 'utf8'), 'export const value = 2\nexport const unstaged=3;\n')
  } finally {
    close()
  }
})

test('PR checks ignore legacy base and actual merges but reject bypassed new commits and bad titles', () => {
  const { cwd, base, close } = repository()
  try {
    ok(run(cwd, 'git', ['switch', '-c', 'feature']))
    writeFileSync(path.join(cwd, 'feature.md'), '# Feature\n')
    ok(run(cwd, 'git', ['add', 'feature.md']))
    ok(run(cwd, 'git', ['commit', '-m', 'feat: add a feature']))
    ok(run(cwd, 'git', ['switch', 'main']))
    ok(run(cwd, 'git', ['merge', '--no-ff', 'feature', '-m', "Merge branch 'feature'"]))
    const head = run(cwd, 'git', ['rev-parse', 'HEAD']).stdout.trim()
    ok(check(cwd, ['--range', base, head]))
    const env = {
      ...environment,
      PR_BASE_SHA: base,
      PR_HEAD_SHA: head,
      PR_TITLE: 'feat: add a feature',
    }
    ok(check(cwd, ['--pr'], undefined, env))
    assert.notEqual(
      check(cwd, ['--pr'], undefined, { ...env, PR_TITLE: 'Unstructured squash title' }).status,
      0,
    )
    ok(
      run(cwd, 'git', [
        '-c',
        'core.hooksPath=disabled-hooks',
        'commit',
        '--allow-empty',
        '-m',
        'Skipped local validation',
      ]),
    )
    assert.notEqual(
      check(cwd, ['--range', base, run(cwd, 'git', ['rev-parse', 'HEAD']).stdout.trim()]).status,
      0,
    )
    assert.notEqual(check(cwd, ['--range', '--all', head]).status, 0)
  } finally {
    close()
  }
})

test('prepare skips CI, hosted builds, production installs and non-Git exports without dev dependencies', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'lunia-export-'))
  try {
    const installer = path.join(cwd, 'install.mjs')
    copyFileSync(path.join(root, '.husky/install.mjs'), installer)
    ok(run(cwd, process.execPath, [installer]))
    mkdirSync(path.join(cwd, '.git'))
    for (const overrides of [
      { CI: 'true' },
      { VERCEL: '1' },
      { NODE_ENV: 'production' as const },
      { HUSKY: '0' },
    ])
      ok(run(cwd, process.execPath, [installer], { env: { ...environment, ...overrides } }))
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})
