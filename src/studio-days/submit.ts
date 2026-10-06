import type { Payload } from 'payload'
import type { privacyState } from '../inquiries/privacy'
import { reserveStudioSlot } from './reservations'
import { captureStudioMeasurement } from './measurement'

// Public visitor submission only; staff reservations and changes use reservations.ts directly.
export async function submitStudioReservation(
  payload: Payload,
  input: Record<string, unknown>,
  privacy: Awaited<ReturnType<typeof privacyState>>,
  send: typeof fetch = fetch,
) {
  const { preferences, campaign, session } = privacy
  const result = await reserveStudioSlot(
    payload,
    input,
    { ...preferences, campaigns: preferences.campaigns && input.campaignsAllowed !== false },
    campaign,
  )
  // Receipt retries may follow changed consent, approval or cancellation. Never backfill.
  try {
    if (
      result.created &&
      preferences.analytics &&
      input.analyticsAllowed !== false &&
      (result.booking.status === 'confirmed' || result.booking.status === 'pending_approval')
    )
      await captureStudioMeasurement(
        payload,
        session,
        Number(input.day),
        {
          event: 'studio_booking_submitted',
          status: result.booking.status,
        },
        send,
      )
  } catch {
    /* Optional measurement must never fail a committed booking; no replay queue. */
  }
  return result
}
