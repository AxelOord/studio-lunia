import { NextRequest, NextResponse } from 'next/server'
export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname
  if (
    process.env.LUNIA_SHOWCASE === 'true' &&
    (path.startsWith('/admin') || path.startsWith('/api') || path.startsWith('/preview'))
  ) {
    return new NextResponse('CMS unavailable in this sample-only preview.', {
      status: 503,
      headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
    })
  }
  const response = NextResponse.next()
  response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  if (path.startsWith('/preview') || request.cookies.has('__prerender_bypass'))
    response.headers.set('Cache-Control', 'private, no-store')
  return response
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] }
