import assert from 'node:assert/strict'
import { copyFile, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import sharp from 'sharp'

// Exercise the deployed dependency subset, not the complete developer node_modules.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const modules = path.join(root, 'node_modules')
const dependencies = new Set()
async function collect(name) {
  if (dependencies.has(name)) return
  dependencies.add(name)
  const manifest = JSON.parse(await readFile(path.join(modules, name, 'package.json'), 'utf8'))
  for (const dependency of Object.keys(manifest.dependencies ?? {})) await collect(dependency)
}
await collect('file-type')
const trace = path.join(root, '.next/server/app/(payload)/api/[...slug]/route.js.nft.json')
const { files } = JSON.parse(await readFile(trace, 'utf8'))
const directory = await mkdtemp(path.join(tmpdir(), 'lunia-upload-trace-'))
try {
  for (const file of files) {
    const source = path.resolve(path.dirname(trace), file)
    const relative = path.relative(modules, source)
    if (relative.startsWith('..') || path.isAbsolute(relative)) continue
    const parts = relative.split(path.sep)
    const name = parts[0].startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
    if (!dependencies.has(name) || !(await stat(source)).isFile()) continue
    const destination = path.join(directory, 'node_modules', relative)
    await mkdir(path.dirname(destination), { recursive: true })
    await copyFile(source, destination)
  }
  await writeFile(
    path.join(directory, 'image.png'),
    await sharp({
      create: { width: 480, height: 320, channels: 3, background: '#65745a' },
    })
      .png()
      .toBuffer(),
  )
  await writeFile(
    path.join(directory, 'probe.mjs'),
    `import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { fileTypeFromFile } from 'file-type'
assert.deepEqual(await fileTypeFromFile('image.png'), { ext: 'png', mime: 'image/png' })
await writeFile('invalid.png', 'This is not an image.')
assert.equal(await fileTypeFromFile('invalid.png'), undefined)
`,
  )
  const result = spawnSync(process.execPath, ['probe.mjs'], {
    cwd: directory,
    encoding: 'utf8',
    timeout: 30000,
    env: { PATH: process.env.PATH },
  })
  assert.equal(result.status, 0, `Traced upload type detection failed:\n${result.stderr}`)
  console.log('Traced server dependencies detect a real PNG and reject non-image bytes.')
} finally {
  await rm(directory, { recursive: true, force: true })
}
