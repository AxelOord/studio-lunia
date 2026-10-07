export function POST() {
  return Response.json(
    { error: 'Real incoming replies are not configured. No event was accepted.' },
    { status: 503, headers: { 'Cache-Control': 'no-store' } },
  )
}
