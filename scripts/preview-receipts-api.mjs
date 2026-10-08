import { createHash } from 'node:crypto'
import { crc32, inflateRawSync } from 'node:zlib'
import { scope, requireCleanup, CleanupError } from './preview-cleanup-identity.mjs'

export const receiptWorkflow = '.github/workflows/preview-ownership.yml'
export const receiptPrefix = 'preview-ownership-'
const maxBytes = 4 * 1024 * 1024

// One bounded data entry, never extracted to disk. Reject encryption, symlinks,
// ZIP64, multiple entries, path names and inconsistent central/local headers.
export function receiptFromZip(bytes, digest) {
  requireCleanup(
    Buffer.isBuffer(bytes) &&
      bytes.length >= 22 &&
      bytes.length <= maxBytes &&
      /^sha256:[a-f0-9]{64}$/.test(digest) &&
      `sha256:${createHash('sha256').update(bytes).digest('hex')}` === digest,
    'receipt-digest-or-size-invalid',
  )
  const end = bytes.length - 22
  requireCleanup(
    bytes.readUInt32LE(end) === 0x06054b50 &&
      bytes.readUInt16LE(end + 4) === 0 &&
      bytes.readUInt16LE(end + 6) === 0 &&
      bytes.readUInt16LE(end + 8) === 1 &&
      bytes.readUInt16LE(end + 10) === 1 &&
      bytes.readUInt16LE(end + 20) === 0,
    'invalid-receipt-archive',
  )
  const central = bytes.readUInt32LE(end + 16)
  requireCleanup(
    central >= 30 &&
      central + 46 <= end &&
      central + bytes.readUInt32LE(end + 12) === end &&
      bytes.readUInt32LE(central) === 0x02014b50,
    'invalid-receipt-archive',
  )
  const flags = bytes.readUInt16LE(central + 8)
  const method = bytes.readUInt16LE(central + 10)
  const checksum = bytes.readUInt32LE(central + 16)
  const compressed = bytes.readUInt32LE(central + 20)
  const length = bytes.readUInt32LE(central + 24)
  const nameLength = bytes.readUInt16LE(central + 28)
  const mode = bytes.readUInt32LE(central + 38) >>> 16
  requireCleanup(
    (flags & ~0x808) === 0 &&
      [0, 8].includes(method) &&
      length > 0 &&
      length <= maxBytes &&
      compressed <= maxBytes &&
      (mode & 0xf000) !== 0xa000 &&
      bytes.readUInt16LE(central + 34) === 0 &&
      bytes.readUInt32LE(central + 42) === 0 &&
      central +
        46 +
        nameLength +
        bytes.readUInt16LE(central + 30) +
        bytes.readUInt16LE(central + 32) ===
        end &&
      bytes.subarray(central + 46, central + 46 + nameLength).toString() === 'ownership.json' &&
      bytes.readUInt32LE(0) === 0x04034b50 &&
      bytes.readUInt16LE(6) === flags &&
      bytes.readUInt16LE(8) === method &&
      bytes.readUInt16LE(26) === nameLength &&
      bytes.subarray(30, 30 + nameLength).toString() === 'ownership.json',
    'invalid-receipt-archive',
  )
  const start = 30 + nameLength + bytes.readUInt16LE(28)
  const finish = start + compressed
  requireCleanup(finish <= central, 'invalid-receipt-archive')
  if (flags & 8) {
    const descriptor = finish + (central - finish === 16 ? 4 : 0)
    requireCleanup(
      [12, 16].includes(central - finish) &&
        (descriptor === finish || bytes.readUInt32LE(finish) === 0x08074b50) &&
        bytes.readUInt32LE(descriptor) === checksum &&
        bytes.readUInt32LE(descriptor + 4) === compressed &&
        bytes.readUInt32LE(descriptor + 8) === length,
      'invalid-receipt-archive',
    )
  } else
    requireCleanup(
      finish === central &&
        bytes.readUInt32LE(14) === checksum &&
        bytes.readUInt32LE(18) === compressed &&
        bytes.readUInt32LE(22) === length,
      'invalid-receipt-archive',
    )
  const data =
    method === 0
      ? bytes.subarray(start, finish)
      : inflateRawSync(bytes.subarray(start, finish), { maxOutputLength: maxBytes })
  requireCleanup(data.length === length && crc32(data) === checksum, 'invalid-receipt-archive')
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(data))
}

async function boundedBody(response) {
  requireCleanup(
    response.body && Number(response.headers.get('content-length') ?? 0) <= maxBytes,
    'receipt-size-invalid',
  )
  const chunks = []
  let size = 0
  for await (const chunk of response.body) {
    size += chunk.length
    requireCleanup(size <= maxBytes, 'receipt-size-invalid')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

export function receiptsAPI(env = process.env, fetcher = fetch) {
  requireCleanup(env.GITHUB_TOKEN, 'receipt-read-access-missing')
  const root = `https://api.github.com/repos/${scope.repository}`
  async function request(path) {
    return fetcher(`${root}${path}`, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(15000),
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })
  }
  async function read(path) {
    const response = await request(path)
    requireCleanup(response.ok, 'receipt-github-read-failed')
    return response.json()
  }
  return {
    workflow: () => read('/actions/workflows/preview-ownership.yml'),
    run: (id, attempt) => {
      requireCleanup(
        Number.isSafeInteger(id) && id > 0 && Number.isSafeInteger(attempt) && attempt > 0,
        'invalid-receipt-run-id',
      )
      return read(`/actions/runs/${id}/attempts/${attempt}`)
    },
    async artifacts() {
      const rows = []
      const ids = new Set()
      let total
      for (let page = 1; page <= 20; page++) {
        const data = await read(`/actions/artifacts?per_page=100&page=${page}`)
        requireCleanup(
          Number.isSafeInteger(data.total_count) &&
            data.total_count >= 0 &&
            data.total_count <= 2000 &&
            (total === undefined || total === data.total_count) &&
            Array.isArray(data.artifacts) &&
            data.artifacts.length <= 100,
          'invalid-artifact-page',
        )
        total = data.total_count
        for (const row of data.artifacts) {
          requireCleanup(
            Number.isSafeInteger(row.id) &&
              row.id > 0 &&
              !ids.has(row.id) &&
              typeof row.name === 'string',
            'invalid-artifact-inventory',
          )
          ids.add(row.id)
          rows.push(row)
        }
        if (rows.length === total) return rows
        requireCleanup(
          rows.length < total && data.artifacts.length === 100,
          'incomplete-artifact-inventory',
        )
      }
      throw new CleanupError('artifact-pagination-incomplete')
    },
    async receipt(artifact) {
      requireCleanup(
        Number.isSafeInteger(artifact.id) &&
          artifact.id > 0 &&
          artifact.size_in_bytes > 0 &&
          artifact.size_in_bytes <= maxBytes,
        'receipt-size-invalid',
      )
      const response = await request(`/actions/artifacts/${artifact.id}/zip`)
      requireCleanup(response.status === 302, 'receipt-download-unavailable')
      const url = new URL(response.headers.get('location'))
      requireCleanup(
        url.protocol === 'https:' &&
          !url.username &&
          !url.password &&
          !url.port &&
          (/^[a-z0-9-]+\.blob\.core\.windows\.net$/.test(url.hostname) ||
            /^[a-z0-9.-]+\.actions\.githubusercontent\.com$/.test(url.hostname)),
        'untrusted-artifact-download-host',
      )
      // The signed URL comes only from GitHub. Never forward the management token.
      const archive = await fetcher(url.href, {
        method: 'GET',
        redirect: 'error',
        signal: AbortSignal.timeout(15000),
      })
      requireCleanup(archive.ok, 'receipt-download-failed')
      return receiptFromZip(await boundedBody(archive), artifact.digest)
    },
  }
}
