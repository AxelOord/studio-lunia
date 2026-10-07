import { after } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { boundedJSON, sameOrigin } from '@/inquiries/http'
import { denied, privacyState } from '@/inquiries/privacy'
import { idInput, object, recordsError } from '@/customer-records/core'
import { limitOperation } from '@/hosting/rate-limit'
import {
  bookingReceipt,
  changeStudioBooking,
  reservationInput,
  reserveStudioSlot,
} from '@/studio-days/reservations'
import { prepareStudioMessages } from '@/studio-days/messages'
import { submitStudioReservation } from '@/studio-days/submit'
import {
  studioAvailability,
  studioReplacementAvailability,
  studioWorkspace,
} from '@/studio-days/queries'

const headers = { 'Cache-Control': 'no-store' }
export async function GET(request: Request) {
  if (process.env.LUNIA_SHOWCASE === 'true') return new Response(null, { status: 503 })
  try {
    const payload = await getPayload({ config })
    const params = new URL(request.url).searchParams
    if (params.has('replacementFor')) {
      const { user } = await payload.auth({ headers: request.headers })
      if (!user) return new Response(null, { status: 401, headers })
      return Response.json(
        await studioReplacementAvailability(
          payload,
          user,
          idInput(Number(params.get('day'))),
          idInput(Number(params.get('replacementFor'))),
        ),
        { headers },
      )
    }
    if (params.has('workspace')) {
      const { user } = await payload.auth({ headers: request.headers })
      if (!user) return new Response(null, { status: 401 })
      return Response.json(
        await studioWorkspace(
          payload,
          user,
          params.has('day') ? idInput(Number(params.get('day'))) : undefined,
        ),
        { headers },
      )
    }
    return Response.json(await studioAvailability(payload, idInput(Number(params.get('day')))), {
      headers,
    })
  } catch (error) {
    return recordsError(error)
  }
}
export async function POST(request: Request) {
  if (process.env.LUNIA_SHOWCASE === 'true') return new Response(null, { status: 503 })
  try {
    sameOrigin(request)
    const input = object(await boundedJSON(request))
    const payload = await getPayload({ config })
    if (input.action !== 'reserve') {
      const { user } = await payload.auth({ headers: request.headers })
      if (!user) return new Response(null, { status: 401 })
      if (input.action === 'staffReserve') {
        const result = await reserveStudioSlot(payload, input, denied, undefined, {
          user,
          contact: input.contact ? idInput(input.contact) : undefined,
        })
        after(() => prepareStudioMessages(payload, result.booking.id))
        return Response.json({ id: result.booking.id }, { headers })
      }
      if (input.action === 'retryMessages') {
        const booking = await payload.findByID({
          collection: 'bookings',
          id: idInput(input.booking),
          user,
          overrideAccess: false,
          depth: 0,
        })
        await prepareStudioMessages(payload, booking.id)
        return Response.json({ id: booking.id }, { headers })
      }
      const result = await changeStudioBooking(payload, user, input)
      after(() => prepareStudioMessages(payload, result.id))
      return Response.json(result, { headers })
    }
    const data = reservationInput(input)
    const ip =
      process.env.VERCEL === '1'
        ? request.headers.get('x-vercel-forwarded-for') || 'unknown'
        : 'local'
    await limitOperation('studio-booking-ip', ip, 20)
    await limitOperation('studio-booking-email', data.email, 5)
    const result = await submitStudioReservation(payload, input, await privacyState())
    after(() => prepareStudioMessages(payload, result.booking.id))
    return Response.json(bookingReceipt(result.booking), { headers })
  } catch (error) {
    return recordsError(error)
  }
}
