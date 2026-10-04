import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'

for (const script of ['preview-operator.ts', 'preview-inventory.ts']) {
  test(`${script} withholds connection and cleanup errors`, () => {
    const marker = 'SYNTHETIC_PRIVATE_PROVIDER_DETAIL'
    for (const failure of ['connect', 'cleanup']) {
      const code = `
        import { Client } from 'pg';
        Client.prototype.connect = async function() {
          ${failure === 'connect' ? `throw new Error('${marker}');` : ''}
        };
        Client.prototype.query = async function() { throw new Error('${marker}'); };
        Client.prototype.end = async function() {
          ${failure === 'cleanup' ? `throw new Error('${marker}');` : ''}
        };
        process.argv = ['node', 'scripts/${script}', 'bootstrap'];
        await import('./scripts/${script}');
      `
      const result = spawnSync(
        process.execPath,
        ['--import', 'tsx', '--input-type=module', '-e', code],
        {
          cwd: process.cwd(),
          env: {
            PATH: process.env.PATH,
            NODE_ENV: 'test',
            DATABASE_URL: 'postgresql://synthetic:dummy@127.0.0.1:1/lunia_preview',
            LUNIA_OPERATOR_TARGET: '127.0.0.1/lunia_preview',
            LUNIA_SHOWCASE: 'false',
          },
          encoding: 'utf8',
          timeout: 15000,
        },
      )
      assert.equal(result.status, 1)
      assert.doesNotMatch(result.stdout + result.stderr, new RegExp(marker))
      assert.match(result.stderr, /failed/i)
    }
  })
}
