import type { Payload } from 'payload'
import { internalTransaction } from '../src/customer-records/core'

// Explicit synthetic preview inventory. Never overwrite an editor's existing day.
export async function seedStudioDemo(payload: Payload) {
  await internalTransaction(payload, async (req) => {
    const existing = await payload.find({
      collection: 'studio-days',
      req,
      overrideAccess: true,
      draft: true,
      limit: 1,
      where: { slug: { equals: 'studio-demo' } },
    })
    if (existing.totalDocs) return
    const date = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
    await payload.create({
      collection: 'studio-days',
      req,
      overrideAccess: true,
      data: {
        title: 'Synthetic studio day — test only',
        slug: 'studio-demo',
        location: 'Synthetic preview studio — no real venue',
        localDate: date,
        timeZone: 'UTC',
        offerTitle: 'Synthetic portrait session',
        inclusions: 'Synthetic planning and portrait session. No real service is offered.',
        durationMinutes: 30,
        bufferMinutes: 15,
        capacity: 1,
        priceMinor: 12300,
        currency: 'EUR',
        opensLocal: '09:00',
        closesLocal: '12:00',
        bookingDeadlineLocal: `${date}T08:00`,
        changePolicy:
          'Synthetic test conditions. Ask the preview editor to change or cancel test reservations. Real business conditions await owner approval.',
        confirmationMode: 'immediate',
        bookingsOpen: true,
        dayState: 'scheduled',
        _status: 'published',
        layout: [
          {
            blockType: 'text',
            heading: 'Preview the session journey',
            body: 'This example is synthetic. The photographer will supply real studio dates, approved images, offers and policies before public use.',
          },
        ],
      },
    })
  })
}
