import { getPayload } from 'payload'
import config from '@payload-config'
import { verifyDelivery } from '@/customer-records/webhook'
import { receiveDelivery } from '@/customer-records/mail'

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret || process.env.LUNIA_RESEND_WEBHOOKS_ENABLED !== 'true')
    return new Response(null, { status: 503 })
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    return new Response(null, { status: 415 })
  const reader = request.body?.getReader()
  if (!reader) return new Response(null, { status: 400 })
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > 65536) {
      await reader.cancel()
      return new Response(null, { status: 413 })
    }
    chunks.push(value)
  }
  let fact
  try {
    fact = verifyDelivery(Buffer.concat(chunks).toString('utf8'), request.headers, secret)
  } catch {
    return new Response(null, { status: 400 })
  }
  if (!fact) return new Response(null, { status: 200 })
  try {
    await receiveDelivery(await getPayload({ config }), fact)
    return new Response(null, { status: 200 })
  } catch {
    return new Response(null, { status: 503 })
  }
}
