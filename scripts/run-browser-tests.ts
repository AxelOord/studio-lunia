import { spawn } from 'node:child_process'
import { createTestDatabase } from '../tests/helpers/database'
import { syntheticEnvironment } from '../tests/helpers/environment'

const npm = process.env.npm_execpath
if (!npm) throw new Error('Run browser verification through npm run test:e2e.')
const database = await createTestDatabase()
const env = syntheticEnvironment(process.env, database.url)

function run(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [npm!, ...args], { env, stdio: 'inherit' })
    child.once('error', reject)
    child.once('exit', (code) =>
      code === 0
        ? resolve()
        : reject(
            new Error(`Browser verification stage failed: npm ${args.join(' ')} (exit ${code})`),
          ),
    )
  })
}
try {
  await run(['run', 'db:migrate'])
  await run(['run', 'seed'])
  await run(['exec', '--', 'playwright', 'test', ...process.argv.slice(2)])
} finally {
  await database.close()
}
