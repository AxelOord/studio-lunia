import { APIError } from 'payload'

export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin')
  if (
    !origin ||
    origin !==
      `${new URL(request.url).protocol}//${request.headers.get('host') ?? new URL(request.url).host}` ||
    request.headers.get('sec-fetch-site') === 'cross-site'
  )
    throw new APIError('This request must come from this website.', 403)
}

export async function boundedJSON(request: Request, limit = 16_384): Promise<unknown> {
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    throw new APIError('Expected a JSON request.', 415)
  const reader = request.body?.getReader()
  if (!reader) throw new APIError('The request is empty.', 400)
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > limit) {
      await reader.cancel()
      throw new APIError('The request is too large.', 413)
    }
    chunks.push(value)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new APIError('The request is not valid JSON.', 400)
  }
}

export function errorResponse(error: unknown) {
  const status = error instanceof APIError ? error.status : 503
  return Response.json(
    {
      error:
        status === 429
          ? 'Too many attempts. Please wait 15 minutes before trying again.'
          : status === 409
            ? 'This enquiry changed after a previous submission. Start a new enquiry.'
            : status >= 500
              ? 'We could not save your enquiry. Your details are still here; please try again.'
              : 'We could not accept this request. Check your details and try again.',
    },
    { status, headers: { 'Cache-Control': 'no-store' } },
  )
}
